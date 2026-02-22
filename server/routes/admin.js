import express from 'express';
import { runQuery, getAllRows, getRow } from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/admin/dashboard - Get admin dashboard stats
router.get('/dashboard', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const registeredTeachers = await getRow(
      'SELECT COUNT(*) as count FROM teachers'
    );
    
    const totalStudents = await getRow(
      'SELECT COUNT(*) as count FROM students'
    );
    
    const totalSessions = await getRow(
      'SELECT COUNT(*) as count FROM attendance_sessions'
    );
    
    res.json({
      success: true,
      stats: {
        approvedTeacherIds: registeredTeachers.count,
        registeredTeachers: registeredTeachers.count,
        totalStudents: totalStudents.count,
        totalSessions: totalSessions.count
      }
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
});

export default router;