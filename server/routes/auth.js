import express from 'express';
import bcrypt from 'bcryptjs';
import { runQuery, getRow, getAllRows } from '../database/connection.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login - Teacher/Student/Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ message: 'Username, password, and role are required' });
    }

    // Get user from database
    const user = await getRow(
      'SELECT * FROM users WHERE username = ? AND role = ?',
      [username, role]
    );

    if (!user) {
      console.error(`Login failed: User not found - username: ${username}, role: ${role}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      console.error(`Login failed: Invalid password for user ${username}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);

    // Get additional user info based on role
    let additionalInfo = {};
    if (role === 'teacher') {
      try {
        const teacherInfo = await getRow('SELECT * FROM teachers WHERE user_id = ?', [user.id]);
        if (teacherInfo) {
          // Get all enrollments from teacher_enrollments table (no is_current or status columns)
          const currentEnrollments = await getAllRows(
            'SELECT DISTINCT semester, class_id, section_id, subject FROM teacher_enrollments WHERE teacher_id = ?',
            [teacherInfo.id]
          );
          
          const semesters = [...new Set(currentEnrollments.map(e => e.semester.toString()))];
          const departments = [...new Set(currentEnrollments.map(e => e.class_id))];
          const sections = [...new Set(currentEnrollments.map(e => e.section_id))];
          const subjects = [...new Set(currentEnrollments.map(e => e.subject))];
          
          additionalInfo = {
            teacherId: teacherInfo.teacher_id,
            semesters: semesters,
            departments: departments,
            sections: sections,
            subjects: subjects
          };
        }
      } catch (enrollmentError) {
        console.error('Error fetching teacher enrollments:', enrollmentError);
        // Continue without enrollment data if there's an error
        additionalInfo = {};
      }
    } else if (role === 'student') {
      const studentInfo = await getRow('SELECT * FROM students WHERE user_id = ?', [user.id]);
      if (studentInfo) {
        // Get current enrollment (most recent)
        const currentEnrollment = await getRow(
          'SELECT * FROM student_enrollments WHERE student_id = ? ORDER BY created_at DESC LIMIT 1',
          [studentInfo.id]
        );
        
        if (currentEnrollment) {
          additionalInfo = {
            usn: studentInfo.usn,
            semester: currentEnrollment.semester,
            department: studentInfo.department,
            classId: currentEnrollment.class_id,
            sectionId: currentEnrollment.section_id,
            subject: currentEnrollment.subject
          };
        } else {
          additionalInfo = {
            usn: studentInfo.usn,
            department: studentInfo.department
          };
        }
      }
    } else if (role === 'admin') {
      // Admin role - no additional info needed
      additionalInfo = {};
    }

    // Return user info (without password)
    const { password_hash, ...userInfo } = user;
    
    res.json({
      token,
      user: { ...userInfo, ...additionalInfo }
    });

  } catch (error) {
    console.error('Login error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/auth/register/teacher - Register new teacher
router.post('/register/teacher', async (req, res) => {
  try {
    const { name, teacherId, email, phone_no, password } = req.body;

    // Validation: Check required fields
    if (!name || !teacherId || !email || !phone_no || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validation: Name minimum 3 characters
    if (name.trim().length < 3) {
      return res.status(400).json({ message: 'Name must be at least 3 characters long' });
    }

    // Validation: Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validation: Phone number (exactly 10 digits)
    if (!/^\d{10}$/.test(phone_no)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    // Validation: Teacher ID minimum 3 characters
    if (teacherId.trim().length < 3) {
      return res.status(400).json({ message: 'Teacher ID must be at least 3 characters long' });
    }

    // Validation: Password length
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if username (teacherId) already exists in users table
    const existingUser = await getRow('SELECT id FROM users WHERE username = ?', [teacherId]);
    if (existingUser) {
      return res.status(409).json({ message: 'Teacher ID already present' });
    }

    // Check if email already exists
    const existingEmail = await getRow('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Check if phone number already exists
    const existingPhone = await getRow('SELECT id FROM users WHERE phone_no = ?', [phone_no]);
    if (existingPhone) {
      return res.status(409).json({ message: 'Phone number already registered' });
    }

    // Check if teacher ID already exists in teachers table
    const existingTeacher = await getRow('SELECT id FROM teachers WHERE teacher_id = ?', [teacherId]);
    if (existingTeacher) {
      return res.status(409).json({ message: 'Teacher ID already present' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Get current local timestamp in YYYY-MM-DD HH:MM:SS format
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const localTimestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    // Create user record
    const userResult = await runQuery(
      'INSERT INTO users (username, password_hash, role, name, email, phone_no, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [teacherId, passwordHash, 'teacher', name, email, phone_no, localTimestamp]
    );

    // Create teacher record (permanent identity) - removed created_at column
    const teacherResult = await runQuery(
      'INSERT INTO teachers (user_id, teacher_id, name) VALUES (?, ?, ?)',
      [userResult.id, teacherId, name]
    );

    res.status(201).json({
      message: 'Teacher account created successfully',
      teacherId: teacherResult.id,
      teacher: {
        id: teacherResult.id,
        teacherId: teacherId,
        name: name
      }
    });

  } catch (error) {
    console.error('Teacher registration error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // Get additional user info based on role
    let additionalInfo = {};
    if (user.role === 'teacher') {
      try {
        const teacherInfo = await getRow('SELECT * FROM teachers WHERE user_id = ?', [user.id]);
        if (teacherInfo) {
          // Get all enrollments from teacher_enrollments table (no is_current or status columns)
          const enrollments = await getAllRows(
            'SELECT DISTINCT semester, class_id, section_id, subject FROM teacher_enrollments WHERE teacher_id = ?',
            [teacherInfo.id]
          );
          
          const semesters = [...new Set(enrollments.map(e => e.semester.toString()))];
          const departments = [...new Set(enrollments.map(e => e.class_id))];
          const sections = [...new Set(enrollments.map(e => e.section_id))];
          const subjects = [...new Set(enrollments.map(e => e.subject))];
          
          console.log('Teacher enrollments loaded:', {
            teacherId: teacherInfo.teacher_id,
            semesters,
            departments,
            sections,
            subjects
          });
          
          additionalInfo = {
            teacherId: teacherInfo.teacher_id,
            semesters: semesters,
            departments: departments,
            sections: sections,
            subjects: subjects
          };
        }
      } catch (enrollmentError) {
        console.error('Error fetching teacher enrollments:', enrollmentError);
        // Continue without enrollment data if there's an error
        additionalInfo = {};
      }
    } else if (user.role === 'student') {
      const studentInfo = await getRow('SELECT * FROM students WHERE user_id = ?', [user.id]);
      if (studentInfo) {
        // Get current enrollment (most recent semester)
        const enrollment = await getRow(
          'SELECT * FROM student_enrollments WHERE student_id = ? ORDER BY semester DESC, created_at DESC LIMIT 1',
          [studentInfo.id]
        );
        
        if (enrollment) {
          additionalInfo = {
            usn: studentInfo.usn,
            semester: enrollment.semester,
            department: studentInfo.department,
            dept: enrollment.class_id,
            sectionId: enrollment.section_id,
            subject: enrollment.subject
          };
        } else {
          additionalInfo = {
            usn: studentInfo.usn,
            department: studentInfo.department
          };
        }
      }
    }
    
    res.json({ user: { ...user, ...additionalInfo } });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/logout - Logout user
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // In a more sophisticated setup, you might want to blacklist the token
    // For now, we'll just return success (client should remove token)
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;