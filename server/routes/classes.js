import express from 'express';
import { getAllRows } from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/classes - Get available classes
router.get('/', authenticateToken, async (req, res) => {
  try {
    const classes = await getAllRows('SELECT * FROM classes ORDER BY name');
    res.json({ classes });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/classes/:classId/sections - Get sections for a class
router.get('/:classId/sections', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;
    const sections = await getAllRows('SELECT * FROM sections WHERE dept = ? ORDER BY section_id', [classId]);
    res.json({ sections });
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;