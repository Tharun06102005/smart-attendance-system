import express from 'express';
import bcrypt from 'bcryptjs';
import { runQuery, getRow, getAllRows } from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// POST /api/teachers/assign-subjects - Assign subjects to teacher
router.post('/assign-subjects', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { teacherId, subjectCombinations, enrollmentDate, completionDate, forceAssign } = req.body;

    // Validation 1: Check all required fields
    if (!teacherId || !subjectCombinations || subjectCombinations.length === 0) {
      return res.status(400).json({ message: 'Please provide teacher ID and subject combinations' });
    }

    if (!enrollmentDate || !completionDate) {
      return res.status(400).json({ message: 'Enrollment date and completion date are required' });
    }

    // Validation 2: Teacher ID format (minimum 3 characters)
    const trimmedTeacherId = teacherId.trim();
    if (trimmedTeacherId.length < 3) {
      return res.status(400).json({ message: 'Teacher ID must be at least 3 characters long' });
    }

    // Database Check 1: Check if teacher exists
    const teacher = await getRow('SELECT id, teacher_id, name FROM teachers WHERE teacher_id = ?', [trimmedTeacherId]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher ID not registered in the system. Please register the teacher first.' });
    }

    // Database Check 2: Check for duplicate assignments (same teacher, same assignment)
    const duplicates = [];
    for (const combo of subjectCombinations) {
      const duplicate = await getRow(
        `SELECT id FROM teacher_enrollments 
         WHERE teacher_id = ? 
         AND semester = ? 
         AND class_id = ? 
         AND section_id = ? 
         AND subject = ?
         AND enrollment_date = ?`,
        [teacher.id, parseInt(combo.semester), combo.department, combo.section, combo.subject, enrollmentDate]
      );

      if (duplicate) {
        duplicates.push(combo);
      }
    }

    if (duplicates.length > 0) {
      return res.status(409).json({ 
        message: `Teacher ${trimmedTeacherId} is already assigned to these subjects`,
        duplicates,
        type: 'duplicate'
      });
    }

    // Database Check 3: Check for conflicts (different teacher, same assignment)
    const conflicts = [];
    for (const combo of subjectCombinations) {
      const conflictingTeacher = await getRow(
        `SELECT t.teacher_id, t.name 
         FROM teacher_enrollments te
         JOIN teachers t ON te.teacher_id = t.id
         WHERE te.semester = ? 
         AND te.class_id = ? 
         AND te.section_id = ? 
         AND te.subject = ?
         AND te.enrollment_date = ?
         AND te.teacher_id != ?`,
        [parseInt(combo.semester), combo.department, combo.section, combo.subject, enrollmentDate, teacher.id]
      );

      if (conflictingTeacher) {
        conflicts.push({
          ...combo,
          existingTeacherId: conflictingTeacher.teacher_id,
          existingTeacherName: conflictingTeacher.name
        });
      }
    }

    // If conflicts found and not forcing, return warning
    if (conflicts.length > 0 && !forceAssign) {
      return res.status(409).json({ 
        message: 'Some subjects are already assigned to other teachers',
        conflicts,
        type: 'conflict',
        requiresConfirmation: true
      });
    }

    // Get local timestamp in YYYY-MM-DD HH:MM:SS format
    const now = new Date();
    const localTimestamp = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');

    // Create enrollment records for each selected subject combination
    const enrollmentIds = [];
    
    for (const combo of subjectCombinations) {
      const result = await runQuery(
        'INSERT INTO teacher_enrollments (teacher_id, class_id, section_id, semester, subject, enrollment_date, completion_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [teacher.id, combo.department, combo.section, parseInt(combo.semester), combo.subject, enrollmentDate, completionDate, localTimestamp]
      );
      enrollmentIds.push(result.id);
    }

    res.status(201).json({
      message: 'Teacher subjects assigned successfully',
      enrollmentCount: enrollmentIds.length,
      enrollmentIds,
      hadConflicts: conflicts.length > 0
    });

  } catch (error) {
    console.error('Assign subjects error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/teachers/:teacherId - Get teacher info
router.get('/:teacherId', authenticateToken, async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacher = await getRow('SELECT * FROM teachers WHERE teacher_id = ?', [teacherId]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Get user details (email, phone)
    const user = await getRow('SELECT email, phone_no FROM users WHERE id = ?', [teacher.user_id]);

    res.json({
      success: true,
      teacher: {
        id: teacher.id,
        teacher_id: teacher.teacher_id,
        name: teacher.name,
        email: user?.email || '',
        phone_no: user?.phone_no || '',
        created_at: teacher.created_at
      }
    });

  } catch (error) {
    console.error('Get teacher error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/teachers/:teacherId - Update teacher details
router.put('/:teacherId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { name, email, phone_no, password } = req.body;

    // Validation 1: Check required fields
    if (!name || !email || !phone_no) {
      return res.status(400).json({ message: 'Name, email, and phone number are required' });
    }

    // Validation 2: Name validation
    if (name.trim().length < 3) {
      return res.status(400).json({ message: 'Name must be at least 3 characters long' });
    }

    // Validation 3: Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    // Validation 4: Phone number validation (required)
    if (phone_no.length !== 10 || !/^\d{10}$/.test(phone_no)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    // Validation 5: Password validation (if provided)
    if (password && password.trim().length > 0 && password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if teacher exists
    const teacher = await getRow('SELECT * FROM teachers WHERE teacher_id = ?', [teacherId]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Get current user data
    const currentUser = await getRow('SELECT email, phone_no FROM users WHERE id = ?', [teacher.user_id]);
    const normalizedCurrentPhone = currentUser.phone_no || '';

    // Check for duplicate email only if email has changed (BEFORE updating)
    if (email !== currentUser.email) {
      const duplicateEmail = await getRow(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, teacher.user_id]
      );
      if (duplicateEmail) {
        return res.status(409).json({ message: 'Email is already registered to another user' });
      }
    }

    // Check for duplicate phone number only if phone has changed (BEFORE updating)
    if (phone_no !== normalizedCurrentPhone) {
      const duplicatePhone = await getRow(
        'SELECT id FROM users WHERE phone_no = ? AND id != ?',
        [phone_no, teacher.user_id]
      );
      if (duplicatePhone) {
        return res.status(409).json({ message: 'Phone number is already registered to another user' });
      }
    }

    // All validations passed - now update the database
    // Update teacher name
    await runQuery(
      'UPDATE teachers SET name = ? WHERE teacher_id = ?',
      [name, teacherId]
    );

    // Update user details
    if (password && password.trim().length > 0) {
      // Update with new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      await runQuery(
        'UPDATE users SET name = ?, email = ?, phone_no = ?, password_hash = ? WHERE id = ?',
        [name, email, phone_no, passwordHash, teacher.user_id]
      );
    } else {
      // Update without changing password
      await runQuery(
        'UPDATE users SET name = ?, email = ?, phone_no = ? WHERE id = ?',
        [name, email, phone_no, teacher.user_id]
      );
    }

    res.json({
      success: true,
      message: 'Teacher details updated successfully'
    });

  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

export default router;
