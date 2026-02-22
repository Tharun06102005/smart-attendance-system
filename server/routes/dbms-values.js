import express from 'express';
import { getAllRows, getRow, runQuery } from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/dbms-values - Get all database tables and their values
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    console.log('Fetching all database values...');
    
    const dbData = {};
    
    // Get all table names
    const tables = await getAllRows(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    console.log(`Found ${tables.length} tables:`, tables.map(t => t.name));
    
    // For each table, get its structure and data (OPTIMIZED: limit to 100 rows for preview)
    for (const table of tables) {
      const tableName = table.name;
      
      try {
        // Get table structure
        const structure = await getAllRows(`PRAGMA table_info(${tableName})`);
        
        // Get table data - OPTIMIZED: Only fetch first 100 rows for preview
        let data;
        try {
          // Try to order by id first, then by first column if id doesn't exist
          // LIMIT 100 for performance with large tables
          data = await getAllRows(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 100`);
        } catch (orderError) {
          // If ordering by id fails, try without ordering or by first column
          try {
            const firstCol = structure[0]?.name;
            if (firstCol) {
              data = await getAllRows(`SELECT * FROM ${tableName} ORDER BY ${firstCol} DESC LIMIT 100`);
            } else {
              data = await getAllRows(`SELECT * FROM ${tableName} LIMIT 100`);
            }
          } catch (fallbackError) {
            data = await getAllRows(`SELECT * FROM ${tableName} LIMIT 100`);
          }
        }
        
        // Get row count (OPTIMIZED: Use COUNT which is fast with indexes)
        const countResult = await getRow(`SELECT COUNT(*) as count FROM ${tableName}`);
        
        dbData[tableName] = {
          structure: structure.map(col => ({
            name: col.name,
            type: col.type,
            notNull: col.notnull === 1,
            defaultValue: col.dflt_value,
            primaryKey: col.pk === 1
          })),
          data: data,
          rowCount: countResult.count,
          isPreview: countResult.count > 100, // Flag to indicate if showing preview
          previewCount: data.length
        };
        
        console.log(`✅ ${tableName}: ${countResult.count} total rows (showing ${data.length}), ${structure.length} columns`);
        console.log(`   Columns: ${structure.map(col => col.name).join(', ')}`);
        
      } catch (error) {
        console.error(`❌ Error fetching ${tableName}:`, error.message);
        dbData[tableName] = {
          error: error.message,
          structure: [],
          data: [],
          rowCount: 0,
          isPreview: false,
          previewCount: 0
        };
      }
    }
    
    // Add database summary
    const summary = {
      totalTables: tables.length,
      totalRows: Object.values(dbData).reduce((sum, table) => sum + (table.rowCount || 0), 0),
      timestamp: new Date().toISOString(),
      user: req.user.name
    };
    
    res.json({
      success: true,
      summary,
      tables: dbData
    });
    
  } catch (error) {
    console.error('DBMS Values API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch database values',
      error: error.message
    });
  }
});

// GET /api/dbms-values/table/:tableName - Get specific table data
router.get('/table/:tableName', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { tableName } = req.params;
    const { limit = 1000, offset = 0 } = req.query; // Add pagination support
    
    // Validate table name to prevent SQL injection
    const validTables = await getAllRows(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    const tableExists = validTables.some(t => t.name === tableName);
    if (!tableExists) {
      return res.status(404).json({
        success: false,
        message: `Table '${tableName}' not found`
      });
    }
    
    // Get table structure
    const structure = await getAllRows(`PRAGMA table_info(${tableName})`);
    
    // Filter out created_at column from teachers table structure
    const filteredStructure = tableName === 'teachers' 
      ? structure.filter(col => col.name !== 'created_at')
      : structure;
    
    // Get table data with pagination (OPTIMIZED)
    const limitNum = Math.min(parseInt(limit), 1000); // Max 1000 rows per request
    const offsetNum = parseInt(offset);
    
    // Build SELECT query - exclude created_at for teachers table
    let selectColumns = '*';
    if (tableName === 'teachers') {
      const columns = structure.filter(col => col.name !== 'created_at').map(col => col.name);
      selectColumns = columns.join(', ');
    }
    
    let data;
    try {
      // Try to order by id for consistent pagination
      data = await getAllRows(`SELECT ${selectColumns} FROM ${tableName} ORDER BY id DESC LIMIT ? OFFSET ?`, [limitNum, offsetNum]);
    } catch (orderError) {
      // Fallback if no id column
      data = await getAllRows(`SELECT ${selectColumns} FROM ${tableName} LIMIT ? OFFSET ?`, [limitNum, offsetNum]);
    }
    
    // Get row count
    const countResult = await getRow(`SELECT COUNT(*) as count FROM ${tableName}`);
    
    res.json({
      success: true,
      tableName,
      structure: filteredStructure.map(col => ({
        name: col.name,
        type: col.type,
        notNull: col.notnull === 1,
        defaultValue: col.dflt_value,
        primaryKey: col.pk === 1
      })),
      data,
      rowCount: countResult.count,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: (offsetNum + limitNum) < countResult.count
      }
    });
    
  } catch (error) {
    console.error(`Table ${req.params.tableName} fetch error:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch table data',
      error: error.message
    });
  }
});

// DELETE /api/dbms-values/delete - Delete a row from a table
router.delete('/delete', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { tableName, primaryKeyColumn, primaryKeyValue } = req.body;

    if (!tableName || !primaryKeyColumn || primaryKeyValue === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tableName, primaryKeyColumn, primaryKeyValue'
      });
    }

    // Validate table name to prevent SQL injection
    const validTables = await getAllRows(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    const tableExists = validTables.some(t => t.name === tableName);
    if (!tableExists) {
      return res.status(404).json({
        success: false,
        message: `Table '${tableName}' not found`
      });
    }

    // Delete the row using runQuery
    const query = `DELETE FROM ${tableName} WHERE ${primaryKeyColumn} = ?`;
    const result = await runQuery(query, [primaryKeyValue]);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Row not found or already deleted'
      });
    }

    console.log(`✅ Deleted row from ${tableName} where ${primaryKeyColumn} = ${primaryKeyValue}`);

    res.json({
      success: true,
      message: `Row deleted successfully from ${tableName}`,
      changes: result.changes
    });

  } catch (error) {
    console.error('Delete row error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete row',
      error: error.message
    });
  }
});

export default router;