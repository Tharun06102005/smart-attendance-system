import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getRow, getAllRows } from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// GET /api/system/stats - Get system statistics (Admin only)
router.get('/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const stats = {};

    // Get user counts by role
    const userStats = await getAllRows(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `);

    stats.users = {};
    userStats.forEach(stat => {
      stats.users[stat.role] = stat.count;
    });

    // Get total students
    const totalStudents = await getRow('SELECT COUNT(*) as count FROM students');
    stats.totalStudents = totalStudents.count;

    // Get recent activity (last 7 days)
    const recentSessions = await getRow(`
      SELECT COUNT(*) as count 
      FROM attendance_sessions 
      WHERE created_at >= datetime('now', '-7 days')
    `);
    stats.recentActivity = recentSessions.count;

    res.json({ stats });

  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/uploads/:filename - Serve uploaded files
router.get('/uploads/:filename', authenticateToken, (req, res) => {
  try {
    const { filename } = req.params;
    const { type = 'students' } = req.query; // students, attendance, etc.

    // Validate file type
    if (!['students', 'attendance'].includes(type)) {
      return res.status(400).json({ message: 'Invalid file type' });
    }

    const filePath = path.join(__dirname, '../uploads', type, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Security check - ensure file is within uploads directory
    const resolvedPath = path.resolve(filePath);
    const uploadsPath = path.resolve(path.join(__dirname, '../uploads'));
    
    if (!resolvedPath.startsWith(uploadsPath)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Serve the file
    res.sendFile(resolvedPath);

  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;