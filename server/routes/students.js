import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { runQuery, getRow, getAllRows } from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/students');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.body.usn || 'student'}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Mock face embedding extraction (ML removed)
const extractFaceEmbeddings = (imagePaths) => {
  return imagePaths.map((path, index) => ({
    embedding: Array.from({ length: 128 }, () => Math.random()),
    quality: 0.8 + Math.random() * 0.2,
    isPrimary: index === 0
  }));
};

// POST /api/students/register - Register new student with face image and ML
router.post('/register', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { name, usn, department, password, email, phone_no, image_base64, filename } = req.body;

    // Validation 1: Check required fields
    if (!name || !usn || !password || !email || !phone_no) {
      return res.status(400).json({ message: 'Name, USN, password, email, and phone number are required' });
    }

    if (!image_base64) {
      return res.status(400).json({ message: 'Face image is required for registration' });
    }

    if (!department) {
      return res.status(400).json({ message: 'Department is required' });
    }

    // Validation 2: Email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validation 3: Phone number format
    if (!/^\d{10}$/.test(phone_no)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    // Validation 4: Check if USN already exists
    const existingStudent = await getRow('SELECT id FROM students WHERE usn = ?', [usn]);
    if (existingStudent) {
      return res.status(409).json({ message: 'Student ID already registered' });
    }

    const existingUser = await getRow('SELECT id FROM users WHERE username = ?', [usn]);
    if (existingUser) {
      return res.status(409).json({ message: 'Student ID already registered' });
    }

    // Validation 5: Check if email already exists
    const existingEmail = await getRow('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Validation 6: Check if phone number already exists
    const existingPhone = await getRow('SELECT id FROM users WHERE phone_no = ?', [phone_no]);
    if (existingPhone) {
      return res.status(409).json({ message: 'Phone number already registered' });
    }

    // All validations passed - now proceed with registration
    
    // Call Python ML service for face embedding FIRST (before saving anything)
    console.log('📤 Sending image to Python ML service for embedding generation...');
    
    let embedding = null;
    let mlError = null;

    try {
      const mlResponse = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          student_id: usn,
          name: name,
          image_base64: image_base64,
          filename: filename || 'image.jpg'
        })
      });

      if (mlResponse.ok) {
        const mlResult = await mlResponse.json();
        embedding = mlResult.embedding;
        console.log(`✅ Face embedding generated: ${mlResult.embedding_dimensions} dimensions`);
      } else {
        const errorData = await mlResponse.json();
        mlError = errorData.detail || 'ML service error';
        console.error('❌ ML service error:', mlError);
      }
    } catch (error) {
      mlError = error.message;
      console.error('❌ Failed to connect to ML service:', error.message);
    }

    // If ML service failed, return error and don't proceed with registration
    if (!embedding) {
      console.error('❌ Face embedding generation failed - registration aborted');
      return res.status(503).json({ 
        message: 'Face recognition service unavailable. Please ensure the ML service is running.',
        error: mlError || 'Failed to generate face embedding',
        mlServiceRequired: true
      });
    }

    // ML service succeeded - now save image to disk
    const uploadDir = path.join(__dirname, '../uploads/students');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const imagePath = path.join(uploadDir, `${usn}-${uniqueSuffix}.jpg`);
    
    // Decode base64 and save
    const imageBuffer = Buffer.from(image_base64, 'base64');
    fs.writeFileSync(imagePath, imageBuffer);

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Get local timestamp in YYYY-MM-DD HH:MM:SS format
    const now = new Date();
    const localTimestamp = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');

    // Create user record
    const userResult = await runQuery(
      'INSERT INTO users (username, password_hash, role, name, email, phone_no, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [usn, passwordHash, 'student', name, email, phone_no, localTimestamp]
    );

    // Create student record with embedding (no enrollments yet)
    const studentResult = await runQuery(
      'INSERT INTO students (user_id, usn, name, department, face_embeddings, captured_image_path) VALUES (?, ?, ?, ?, ?, ?)',
      [userResult.id, usn, name, department, JSON.stringify([embedding]), imagePath]
    );

    res.status(201).json({
      message: 'Student registered successfully. Admin will assign semester and section.',
      studentId: studentResult.id,
      usn: usn,
      name: name,
      embeddingGenerated: true
    });

  } catch (error) {
    console.error('Student registration error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/students/by-class/:classId/:sectionId - Get students in class with embeddings
router.get('/by-class/:classId/:sectionId', authenticateToken, async (req, res) => {
  try {
    const { classId, sectionId } = req.params;
    const { subject, semester } = req.query;

    let query = `
      SELECT 
        s.id, 
        s.usn, 
        s.name,
        s.face_embeddings,
        se.class_id, 
        se.section_id, 
        se.semester, 
        se.subject
      FROM students s
      JOIN student_enrollments se ON s.id = se.student_id
      WHERE se.class_id = ? AND se.section_id = ?
    `;
    
    const params = [classId, sectionId];

    // Add subject filter if provided
    if (subject) {
      query += ' AND se.subject = ?';
      params.push(subject);
    }

    // Add semester filter if provided
    if (semester) {
      query += ' AND se.semester = ?';
      params.push(parseInt(semester));
    }

    // Only get currently enrolled students
    query += ' AND se.enrollment_date <= date("now")';
    query += ' ORDER BY s.name';

    const students = await getAllRows(query, params);

    // Parse embeddings for each student
    const studentsWithEmbeddings = students.map(student => {
      let embedding = null;
      if (student.face_embeddings) {
        try {
          const embeddings = JSON.parse(student.face_embeddings);
          // Get first embedding (primary)
          embedding = Array.isArray(embeddings) && embeddings.length > 0 ? embeddings[0] : null;
        } catch (e) {
          console.error(`Failed to parse embeddings for student ${student.usn}:`, e);
        }
      }

      return {
        id: student.id,
        usn: student.usn,
        name: student.name,
        embedding: embedding,
        class_id: student.class_id,
        section_id: student.section_id,
        semester: student.semester,
        subject: student.subject
      };
    });

    res.json({ 
      students: studentsWithEmbeddings,
      filters: {
        classId,
        sectionId,
        subject: subject || null,
        semester: semester || null
      },
      count: studentsWithEmbeddings.length
    });

  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/classes - Get available classes
router.get('/classes', authenticateToken, async (req, res) => {
  try {
    const classes = await getAllRows('SELECT * FROM classes ORDER BY name');
    res.json({ classes });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/sections/:classId - Get sections for a class
router.get('/sections/:classId', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;
    const sections = await getAllRows('SELECT * FROM sections WHERE dept = ? ORDER BY section_id', [classId]);
    res.json({ sections });
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/students/get-by-usn/:usn - Get student by USN
router.get('/get-by-usn/:usn', authenticateToken, async (req, res) => {
  try {
    const { usn } = req.params;

    const student = await getRow('SELECT id, usn, name, department FROM students WHERE usn = ?', [usn]);
    
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.json({ success: true, student });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/students/assign-semester - Assign semester to student
router.post('/assign-semester', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { usn, sectionId, semester, department, subjects, enrollmentDate, completionDate } = req.body;

    if (!usn || !sectionId || !semester || !department || !subjects || subjects.length === 0) {
      return res.status(400).json({ message: 'Please provide student ID, section, semester, department, and subjects' });
    }

    if (!enrollmentDate || !completionDate) {
      return res.status(400).json({ message: 'Enrollment date and completion date are required' });
    }

    // Check 1: If student exists
    const student = await getRow('SELECT id FROM students WHERE usn = ?', [usn]);
    if (!student) {
      return res.status(404).json({ message: 'Student ID not registered' });
    }

    // Extract year and month from enrollmentDate (format: YYYY-MM-DD)
    const enrollmentYearMonth = enrollmentDate.substring(0, 7); // Gets YYYY-MM

    // Check 2: If year-month already exists for this student
    const existingEnrollment = await getRow(
      'SELECT id, semester, enrollment_date FROM student_enrollments WHERE student_id = ? AND enrollment_date LIKE ?',
      [student.id, `${enrollmentYearMonth}%`]
    );

    if (existingEnrollment) {
      const existingDate = new Date(existingEnrollment.enrollment_date);
      const monthName = existingDate.toLocaleString('default', { month: 'long' });
      const year = existingDate.getFullYear();
      return res.status(409).json({ 
        message: `Student is already enrolled for ${monthName} ${year}. A student cannot have two semester enrollments at the same date.`
      });
    }

    // Check 3: If this specific semester already exists for this student
    const existingSemester = await getRow(
      'SELECT id, enrollment_date FROM student_enrollments WHERE student_id = ? AND semester = ?',
      [student.id, parseInt(semester)]
    );

    if (existingSemester) {
      return res.status(409).json({ 
        message: `Student is already enrolled in Semester ${semester}. A student cannot enroll in the same semester twice.`
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

    // Create enrollment records for each subject
    const enrollmentIds = [];
    for (const subject of subjects) {
      const result = await runQuery(
        'INSERT INTO student_enrollments (student_id, class_id, section_id, semester, subject, enrollment_date, completion_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [student.id, department, sectionId, parseInt(semester), subject, enrollmentDate, completionDate, localTimestamp]
      );
      enrollmentIds.push(result.id);
    }

    res.status(201).json({
      message: 'Student semester assignment successful',
      enrollmentCount: enrollmentIds.length,
      enrollmentIds
    });

  } catch (error) {
    console.error('Assign semester error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/students/:usn - Get student by USN
router.get('/:usn', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { usn } = req.params;

    const student = await getRow(
      `SELECT s.id, s.usn, s.name, s.department, s.captured_image_path, s.user_id,
              u.email, u.phone_no
       FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE s.usn = ?`,
      [usn]
    );

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({ student });

  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/students/:usn/enrollments - Get student enrollments
router.get('/:usn/enrollments', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { usn } = req.params;

    // Check if student exists
    const student = await getRow('SELECT id FROM students WHERE usn = ?', [usn]);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Get all enrollments for this student
    const enrollments = await getAllRows(
      `SELECT id, semester, class_id, section_id, subject, enrollment_date, completion_date
       FROM student_enrollments
       WHERE student_id = ?
       ORDER BY enrollment_date DESC, semester ASC`,
      [student.id]
    );

    res.json({ enrollments });

  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// PUT /api/students/:usn - Update student information
router.put('/:usn', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { usn } = req.params;
    const { name, email, phone_no, password } = req.body;

    // Validation 1: Check required fields are not empty
    if (!name || name.trim().length < 3) {
      return res.status(400).json({ message: 'Full Name must be at least 3 characters long' });
    }

    // Validation 2: Email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Validation 3: Phone number (exactly 10 digits)
    if (!phone_no || !/^\d{10}$/.test(phone_no)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    // Validation 4: Password length if provided
    if (password && password.trim() && password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if student exists
    const student = await getRow('SELECT id, user_id FROM students WHERE usn = ?', [usn]);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Check if email is already used by another user (BEFORE updating)
    const existingEmail = await getRow('SELECT id FROM users WHERE email = ? AND id != ?', [email, student.user_id]);
    if (existingEmail) {
      return res.status(409).json({ message: 'Email already registered to another user' });
    }

    // Check if phone number is already used by another user (BEFORE updating)
    const existingPhone = await getRow('SELECT id FROM users WHERE phone_no = ? AND id != ?', [phone_no, student.user_id]);
    if (existingPhone) {
      return res.status(409).json({ message: 'Phone number already registered to another user' });
    }

    // All validations passed - now update the database
    // Update student table (only name, department is read-only)
    await runQuery(
      'UPDATE students SET name = ? WHERE usn = ?',
      [name.trim(), usn]
    );

    // Update users table
    const userUpdates = [];
    const userParams = [];

    if (email !== undefined) {
      userUpdates.push('email = ?');
      userParams.push(email.trim());
    }
    if (phone_no !== undefined) {
      userUpdates.push('phone_no = ?');
      userParams.push(phone_no.trim());
    }
    if (name !== undefined) {
      userUpdates.push('name = ?');
      userParams.push(name.trim());
    }
    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password, 10);
      userUpdates.push('password_hash = ?');
      userParams.push(hashedPassword);
    }

    if (userUpdates.length > 0) {
      userParams.push(student.user_id);
      await runQuery(
        `UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`,
        userParams
      );
    }

    res.json({ message: 'Student updated successfully' });

  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// PUT /api/students/:usn/update-image - Update student face image and embedding
router.put('/:usn/update-image', authenticateToken, requireRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { usn } = req.params;
    const { image_base64, filename } = req.body;

    if (!image_base64) {
      return res.status(400).json({ message: 'Face image is required' });
    }

    // Check if student exists
    const student = await getRow('SELECT id, name, captured_image_path FROM students WHERE usn = ?', [usn]);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Delete old image if exists
    if (student.captured_image_path && fs.existsSync(student.captured_image_path)) {
      try {
        fs.unlinkSync(student.captured_image_path);
        console.log('✓ Deleted old image:', student.captured_image_path);
      } catch (err) {
        console.error('Warning: Could not delete old image:', err.message);
      }
    }

    // Save new image to disk
    const uploadDir = path.join(__dirname, '../uploads/students');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const imagePath = path.join(uploadDir, `${usn}-${uniqueSuffix}.jpg`);
    
    // Decode base64 and save
    const imageBuffer = Buffer.from(image_base64, 'base64');
    fs.writeFileSync(imagePath, imageBuffer);

    // Call Python ML service for face embedding
    console.log('📤 Sending image to Python ML service for embedding generation...');
    
    let embedding = null;
    let mlError = null;

    try {
      const mlResponse = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          student_id: usn,
          name: student.name,
          image_base64: image_base64,
          filename: filename || 'image.jpg'
        })
      });

      if (mlResponse.ok) {
        const mlResult = await mlResponse.json();
        embedding = mlResult.embedding;
        console.log(`✅ Face embedding generated: ${mlResult.embedding_dimensions} dimensions`);
      } else {
        const errorData = await mlResponse.json();
        mlError = errorData.detail || 'ML service error';
        console.error('❌ ML service error:', mlError);
      }
    } catch (error) {
      mlError = error.message;
      console.error('❌ Failed to connect to ML service:', error.message);
    }

    // If ML service failed, return error and don't proceed with update
    if (!embedding) {
      console.error('❌ Face embedding generation failed - image update aborted');
      
      // Delete the saved image file since update failed
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      
      return res.status(503).json({ 
        message: 'Face recognition service unavailable. Please ensure the ML service is running.',
        error: mlError || 'Failed to generate face embedding',
        mlServiceRequired: true
      });
    }

    // Update student record with new embedding and image path
    await runQuery(
      'UPDATE students SET face_embeddings = ?, captured_image_path = ? WHERE usn = ?',
      [JSON.stringify([embedding]), imagePath, usn]
    );

    res.json({ 
      message: 'Student image and face embedding updated successfully',
      embeddingGenerated: true
    });

  } catch (error) {
    console.error('Update image error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});


export default router;