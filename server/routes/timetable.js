import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { runQuery, getRow, getAllRows } from '../database/connection.js';

const router = express.Router();

// GET /api/timetable - Get all timetable entries with filters
router.get('/', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { semester, department, section, dayOfWeek } = req.query;

    let query = 'SELECT * FROM timetable WHERE 1=1';
    const params = [];

    if (semester) {
      query += ' AND semester = ?';
      params.push(semester);
    }

    if (department) {
      query += ' AND department = ?';
      params.push(department);
    }

    if (section) {
      query += ' AND section = ?';
      params.push(section);
    }

    if (dayOfWeek) {
      query += ' AND day_of_week = ?';
      params.push(dayOfWeek);
    }

    // Only get default timetable (date IS NULL)
    query += ' AND date IS NULL';
    query += ' ORDER BY day_of_week, start_time';

    const timetable = await getAllRows(query, params);

    res.json({
      success: true,
      timetable
    });

  } catch (error) {
    console.error('Get timetable error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/timetable - Create new timetable entry
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { semester, department, section, subject, dayOfWeek, startTime, endTime } = req.body;

    if (!semester || !department || !section || !subject || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const result = await runQuery(`
      INSERT INTO timetable (semester, department, section, subject, day_of_week, start_time, end_time, date)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `, [semester, department, section, subject, dayOfWeek, startTime, endTime]);

    res.status(201).json({
      success: true,
      message: 'Timetable entry created',
      id: result.id
    });

  } catch (error) {
    console.error('Create timetable error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// DELETE /api/timetable/:id - Delete timetable entry
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    await runQuery('DELETE FROM timetable WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Timetable entry deleted'
    });

  } catch (error) {
    console.error('Delete timetable error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Helper function to calculate period number from start time
const calculatePeriodNumber = (startTime) => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  
  // Assuming periods start at 9:00 AM and each period is 1 hour
  // Period 1: 9:00, Period 2: 10:00, Period 3: 11:00, etc.
  const firstPeriodStart = 9 * 60; // 9:00 AM in minutes
  const periodDuration = 60; // 60 minutes per period
  
  if (totalMinutes < firstPeriodStart) return 0;
  
  return Math.floor((totalMinutes - firstPeriodStart) / periodDuration) + 1;
};

// Helper function to check if current time is within time window
const isWithinTimeWindow = (currentTime, startTime, endTime) => {
  const bufferBefore = 10; // minutes
  const bufferAfter = 15; // minutes
  
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const startMinutes = startHour * 60 + startMin - bufferBefore;
  const endMinutes = endHour * 60 + endMin + bufferAfter;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

// GET /api/timetable/class/schedule - Get timetable for a specific class on a date
router.get('/class/schedule', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { date, semester, department, section } = req.query;
    
    if (!date || !semester || !department || !section) {
      return res.status(400).json({ message: 'Date, semester, department, and section are required' });
    }

    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    // Get day of week from date
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    
    // First, try to get date-specific timetable
    let timetable = await getAllRows(`
      SELECT * FROM timetable
      WHERE date = ?
        AND semester = ?
        AND department = ?
        AND section = ?
      ORDER BY start_time
    `, [date, semester, department, section]);

    // If no date-specific timetable, get default timetable
    if (timetable.length === 0) {
      timetable = await getAllRows(`
        SELECT * FROM timetable
        WHERE day_of_week = ?
          AND semester = ?
          AND department = ?
          AND section = ?
          AND date IS NULL
        ORDER BY start_time
      `, [dayOfWeek, semester, department, section]);
    }

    // Calculate period numbers and current status
    // NOTE: We show ALL timetable entries, enrollment check happens in authorization endpoint
    const currentTime = new Date();
    const schedule = timetable.map(entry => {
      const periodNumber = calculatePeriodNumber(entry.start_time);
      const isCurrent = isWithinTimeWindow(currentTime, entry.start_time, entry.end_time);
      
      // Check if past or upcoming
      const [startHour, startMin] = entry.start_time.split(':').map(Number);
      const [endHour, endMin] = entry.end_time.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
      
      const isPast = currentMinutes > (endMinutes + 15); // After end time + buffer
      const isUpcoming = currentMinutes < (startMinutes - 10); // Before start time - buffer
      
      return {
        id: entry.id,
        period_number: periodNumber,
        start_time: entry.start_time,
        end_time: entry.end_time,
        semester: entry.semester,
        department: entry.department,
        section: entry.section,
        subject: entry.subject,
        is_current: isCurrent,
        is_past: isPast,
        is_upcoming: isUpcoming
      };
    });

    // Find current period
    const currentPeriod = schedule.find(s => s.is_current) || null;

    res.json({
      success: true,
      schedule,
      current_period: currentPeriod
    });

  } catch (error) {
    console.error('Get class schedule error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/timetable/check-existing-session - Check if session already exists
router.get('/check-existing-session', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { date, semester, department, section, subject } = req.query;
    
    if (!date || !semester || !department || !section || !subject) {
      return res.status(400).json({ message: 'All parameters are required' });
    }

    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    // Get current time to find the matching timetable period
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    // Get the day of week for the date
    const dateObj = new Date(date);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dateObj.getDay()];

    // Find the timetable entry for this subject at the current time
    const timetableEntry = await getRow(`
      SELECT id, start_time, end_time, period
      FROM timetable
      WHERE semester = ?
        AND class_id = ?
        AND section_id = ?
        AND subject = ?
        AND day = ?
    `, [semester, department, section, subject, dayName]);

    if (!timetableEntry) {
      // If no timetable entry found, check for any session with this subject today
      const session = await getRow(`
        SELECT id FROM attendance_sessions
        WHERE teacher_id = ?
          AND session_date = ?
          AND semester = ?
          AND class_id = ?
          AND section_id = ?
          AND subject_name = ?
      `, [teacher.id, date, semester, department, section, subject]);

      return res.json({
        success: true,
        session_exists: !!session,
        session_id: session?.id || null
      });
    }

    // Parse timetable times
    const [startHour, startMin] = timetableEntry.start_time.split(':').map(Number);
    const [endHour, endMin] = timetableEntry.end_time.split(':').map(Number);
    const startTimeInMinutes = startHour * 60 + startMin;
    const endTimeInMinutes = endHour * 60 + endMin;

    // Check if there's already a session for this specific time slot (within ±30 minutes)
    // This allows multiple sessions of the same subject on different periods
    const session = await getRow(`
      SELECT id, session_time FROM attendance_sessions
      WHERE teacher_id = ?
        AND session_date = ?
        AND semester = ?
        AND class_id = ?
        AND section_id = ?
        AND subject_name = ?
    `, [teacher.id, date, semester, department, section, subject]);

    if (session) {
      // Check if the existing session time matches the current period
      const [sessionHour, sessionMin] = session.session_time.split(':').map(Number);
      const sessionTimeInMinutes = sessionHour * 60 + sessionMin;

      // If the session time is within ±30 minutes of the current period, it's a duplicate
      const timeDifference = Math.abs(sessionTimeInMinutes - startTimeInMinutes);
      
      if (timeDifference <= 30) {
        return res.json({
          success: true,
          session_exists: true,
          session_id: session.id
        });
      }
    }

    // No matching session found for this time slot
    res.json({
      success: true,
      session_exists: false,
      session_id: null
    });

  } catch (error) {
    console.error('Check existing session error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/timetable/check-authorization - Check if teacher is authorized for specific class
router.post('/check-authorization', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { semester, department, section, subject, date } = req.body;

    if (!semester || !department || !section || !subject) {
      return res.status(400).json({ 
        success: false,
        authorized: false,
        message: 'All fields are required' 
      });
    }

    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ 
        success: false,
        authorized: false,
        message: 'Teacher record not found' 
      });
    }

    // Use provided date or current date
    const checkDate = date || new Date().toISOString().split('T')[0];

    // Check exact combination in teacher_enrollments with date validation
    const enrollment = await getRow(`
      SELECT * FROM teacher_enrollments 
      WHERE teacher_id = ? 
        AND semester = ? 
        AND class_id = ? 
        AND section_id = ? 
        AND subject = ?
        AND enrollment_date <= ?
        AND (completion_date IS NULL OR completion_date >= ?)
    `, [teacher.id, semester, department, section, subject, checkDate, checkDate]);

    if (!enrollment) {
      // Check if enrollment exists but is inactive
      const inactiveEnrollment = await getRow(`
        SELECT * FROM teacher_enrollments 
        WHERE teacher_id = ? 
          AND semester = ? 
          AND class_id = ? 
          AND section_id = ? 
          AND subject = ?
      `, [teacher.id, semester, department, section, subject]);

      if (inactiveEnrollment) {
        // Enrollment exists but is not active on this date
        if (inactiveEnrollment.enrollment_date > checkDate) {
          return res.json({
            success: false,
            authorized: false,
            message: `Your assignment for ${subject} has not started yet. It begins on ${inactiveEnrollment.enrollment_date}.`
          });
        } else if (inactiveEnrollment.completion_date && inactiveEnrollment.completion_date < checkDate) {
          return res.json({
            success: false,
            authorized: false,
            message: `Your assignment for ${subject} ended on ${inactiveEnrollment.completion_date}. You are no longer authorized to take attendance for this class.`
          });
        }
      }

      return res.json({
        success: false,
        authorized: false,
        message: `You are not assigned to teach ${subject} for ${department}-${section}, Semester ${semester}`
      });
    }

    res.json({
      success: true,
      authorized: true,
      message: 'Teacher is authorized'
    });

  } catch (error) {
    console.error('Check authorization error:', error);
    res.status(500).json({ 
      success: false,
      authorized: false,
      message: 'Internal server error' 
    });
  }
});

// GET /api/timetable/subjects-by-department - Get subjects for a specific department
router.get('/subjects-by-department', authenticateToken, async (req, res) => {
  try {
    const { semester, department, section } = req.query;

    console.log('Fetching subjects for:', { semester, department, section });

    if (!semester || !department || !section) {
      return res.status(400).json({ message: 'Semester, department, and section are required' });
    }

    // Get distinct subjects from attendance_sessions (actual classes taught)
    // This is better than timetable because it shows subjects that actually have attendance data
    const subjects = await getAllRows(`
      SELECT DISTINCT subject_name as subject
      FROM attendance_sessions 
      WHERE semester = ? AND class_id = ? AND section_id = ?
      ORDER BY subject_name
    `, [semester, department, section]);

    console.log('Found subjects from attendance_sessions:', subjects);

    // If no subjects found in attendance_sessions, fallback to student_enrollments
    if (subjects.length === 0) {
      console.log('No subjects in attendance_sessions, checking student_enrollments...');
      const enrollmentSubjects = await getAllRows(`
        SELECT DISTINCT subject
        FROM student_enrollments 
        WHERE semester = ? AND class_id = ? AND section_id = ?
        ORDER BY subject
      `, [semester, department, section]);
      
      console.log('Found subjects from student_enrollments:', enrollmentSubjects);
      
      return res.json({
        success: true,
        subjects: enrollmentSubjects.map(s => s.subject)
      });
    }

    res.json({
      success: true,
      subjects: subjects.map(s => s.subject)
    });

  } catch (error) {
    console.error('Get subjects by department error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/timetable/by-day - Get timetable for a specific day (for students)
router.get('/by-day', authenticateToken, async (req, res) => {
  try {
    const { semester, department, section, day, date } = req.query;

    console.log('Fetching timetable by day:', { semester, department, section, day, date });

    if (!semester || !department || !section || !day) {
      return res.status(400).json({ message: 'Semester, department, section, and day are required' });
    }

    let timetable = [];

    // If date is provided, first try to get date-specific timetable
    if (date) {
      timetable = await getAllRows(`
        SELECT 
          t.id,
          t.day_of_week as day,
          t.start_time,
          t.end_time,
          t.subject,
          '' as teacher_name,
          '' as room,
          ROW_NUMBER() OVER (ORDER BY t.start_time) as period
        FROM timetable t
        WHERE t.semester = ? 
          AND t.department = ? 
          AND t.section = ? 
          AND t.date = ?
        ORDER BY t.start_time
      `, [semester, department, section, date]);

      console.log(`Found ${timetable.length} date-specific timetable entries for ${date}`);
    }

    // If no date-specific timetable found, get default timetable for the day
    if (timetable.length === 0) {
      timetable = await getAllRows(`
        SELECT 
          t.id,
          t.day_of_week as day,
          t.start_time,
          t.end_time,
          t.subject,
          '' as teacher_name,
          '' as room,
          ROW_NUMBER() OVER (ORDER BY t.start_time) as period
        FROM timetable t
        WHERE t.semester = ? 
          AND t.department = ? 
          AND t.section = ? 
          AND t.day_of_week = ?
          AND t.date IS NULL
        ORDER BY t.start_time
      `, [semester, department, section, day]);

      console.log(`Found ${timetable.length} default timetable entries for ${day}`);
    }

    res.json({
      success: true,
      timetable: timetable
    });

  } catch (error) {
    console.error('Get timetable by day error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/timetable/for-date - Get timetable for specific date (Feature 2)
router.get('/for-date', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { date, semester, department, section } = req.query;
    
    if (!date || !semester || !department || !section) {
      return res.status(400).json({ message: 'All parameters are required' });
    }

    // Get day of week from date
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    
    // First, try to get date-specific timetable
    let timetable = await getAllRows(`
      SELECT * FROM timetable
      WHERE date = ?
        AND semester = ?
        AND department = ?
        AND section = ?
      ORDER BY start_time
    `, [date, semester, department, section]);

    let isLocked = false;
    let source = 'default';

    // If date-specific timetable exists, it's locked
    if (timetable.length > 0) {
      isLocked = true;
      source = 'date-specific';
    } else {
      // Get default timetable for this day of week
      timetable = await getAllRows(`
        SELECT * FROM timetable
        WHERE day_of_week = ?
          AND semester = ?
          AND department = ?
          AND section = ?
          AND date IS NULL
        ORDER BY start_time
      `, [dayOfWeek, semester, department, section]);
    }

    res.json({
      success: true,
      is_locked: isLocked,
      source: source,
      timetable: timetable,
      day_of_week: dayOfWeek
    });

  } catch (error) {
    console.error('Get timetable for date error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/timetable/update-for-date - Create date-specific timetable (Feature 2)
router.post('/update-for-date', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { date, semester, department, section, timetable } = req.body;
    
    if (!date || !semester || !department || !section || !timetable || !Array.isArray(timetable)) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required and timetable must be an array' 
      });
    }

    // Check if date-specific timetable already exists (locked)
    const existing = await getRow(`
      SELECT COUNT(*) as count FROM timetable 
      WHERE date = ? AND semester = ? AND department = ? AND section = ?
    `, [date, semester, department, section]);

    if (existing.count > 0) {
      return res.status(400).json({
        success: false,
        message: 'This date is already locked. Cannot edit existing date-specific timetable.'
      });
    }

    // Get day of week for this date
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    // Insert new rows with specific date (NEVER UPDATE default)
    let rowsInserted = 0;
    for (const entry of timetable) {
      await runQuery(`
        INSERT INTO timetable (
          date, day_of_week, semester, department, section,
          start_time, end_time, subject
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        date,
        dayOfWeek,
        semester,
        department,
        section,
        entry.start_time,
        entry.end_time,
        entry.subject
      ]);
      rowsInserted++;
    }

    res.json({
      success: true,
      message: `Timetable updated for ${date}`,
      rows_inserted: rowsInserted
    });

  } catch (error) {
    console.error('Update timetable for date error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error', 
      error: error.message 
    });
  }
});

export default router;
