import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { runQuery, getRow, getAllRows } from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Python executable path (use virtual environment on Windows)
const PYTHON_PATH = process.platform === 'win32'
  ? path.join(path.dirname(__dirname), '..', 'myenv', 'Scripts', 'python.exe')
  : 'python';

/**
 * Call Python ML models to calculate predictions
 */
const callMLModels = (attendanceData) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Call all 4 models
      const model1Script = path.join(__dirname, '../ml/model1_trend_analysis.py');
      const model3Script = path.join(__dirname, '../ml/model3_consistency_analysis.py');
      const model4Script = path.join(__dirname, '../ml/model4_attentiveness_analysis.py');
      const model2Script = path.join(__dirname, '../ml/model2_risk_prediction.py');

      // Model 1: Trend Analysis
      const model1Result = await new Promise((res, rej) => {
        const python = spawn(PYTHON_PATH, [model1Script]);
        let output = '';
        let error = '';
        
        python.stdin.write(JSON.stringify(attendanceData));
        python.stdin.end();
        
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });
        python.on('close', (code) => {
          if (code !== 0) rej(new Error(`Model 1 failed: ${error}`));
          else {
            try { res(JSON.parse(output)); }
            catch (e) { rej(new Error('Failed to parse Model 1 output')); }
          }
        });
      });

      // Model 3: Consistency Analysis
      const model3Result = await new Promise((res, rej) => {
        const python = spawn(PYTHON_PATH, [model3Script]);
        let output = '';
        let error = '';
        
        python.stdin.write(JSON.stringify(attendanceData));
        python.stdin.end();
        
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });
        python.on('close', (code) => {
          if (code !== 0) rej(new Error(`Model 3 failed: ${error}`));
          else {
            try { res(JSON.parse(output)); }
            catch (e) { rej(new Error('Failed to parse Model 3 output')); }
          }
        });
      });

      // Model 4: Attentiveness Analysis
      const model4Result = await new Promise((res, rej) => {
        const python = spawn(PYTHON_PATH, [model4Script]);
        let output = '';
        let error = '';
        
        const input = {
          attendance_data: attendanceData,
          consistency_from_model3: model3Result.consistency
        };
        
        python.stdin.write(JSON.stringify(input));
        python.stdin.end();
        
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });
        python.on('close', (code) => {
          if (code !== 0) rej(new Error(`Model 4 failed: ${error}`));
          else {
            try { res(JSON.parse(output)); }
            catch (e) { rej(new Error('Failed to parse Model 4 output')); }
          }
        });
      });

      // Model 2: Risk Prediction
      const model2Result = await new Promise((res, rej) => {
        const python = spawn(PYTHON_PATH, [model2Script]);
        let output = '';
        let error = '';
        
        const input = {
          student_data: attendanceData,
          model1_result: model1Result,
          model3_result: model3Result,
          model4_result: model4Result,
          class_data: null,
          total_sessions_planned: 50
        };
        
        python.stdin.write(JSON.stringify(input));
        python.stdin.end();
        
        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });
        python.on('close', (code) => {
          if (code !== 0) rej(new Error(`Model 2 failed: ${error}`));
          else {
            try { res(JSON.parse(output)); }
            catch (e) { rej(new Error('Failed to parse Model 2 output')); }
          }
        });
      });

      resolve({
        trend: model1Result.trend,
        consistency: model3Result.consistency,
        attentiveness: model4Result.attentiveness,
        risk: model2Result.risk
      });

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Calculate and store ML predictions for all students in a session
 */
const calculateAndStoreMLPredictions = async (sessionId, semester, subject) => {
  console.log(`🤖 Calculating ML predictions for session ${sessionId}, subject: ${subject}`);
  
  // Get all students who have attendance records in this session
  const studentsInSession = await getAllRows(`
    SELECT DISTINCT ar.student_id, s.usn
    FROM attendance_records ar
    JOIN students s ON ar.student_id = s.id
    WHERE ar.session_id = ?
  `, [sessionId]);

  console.log(`📊 Found ${studentsInSession.length} students in session`);

  let successCount = 0;
  let failureCount = 0;

  // Calculate ML for each student
  for (const studentRecord of studentsInSession) {
    try {
      const studentId = studentRecord.student_id;
      
      // Get all attendance data for this student and subject
      const attendanceData = await getAllRows(`
        SELECT ar.status, ar.confidence, ar.emotion, ar.attentiveness, ar.marked_at, ats.session_date
        FROM attendance_records ar
        JOIN attendance_sessions ats ON ar.session_id = ats.id
        WHERE ar.student_id = ? AND ats.subject_name = ? AND ats.semester = ?
        ORDER BY ats.session_date ASC
      `, [studentId, subject, semester]);

      if (attendanceData.length === 0) {
        console.log(`⚠️ No attendance data for student ${studentId}, skipping`);
        continue;
      }

      console.log(`🔍 Student ${studentRecord.usn}: ${attendanceData.length} attendance records`);

      // Call ML models
      const mlResults = await callMLModels(attendanceData);
      
      console.log(`✅ ML Results for ${studentRecord.usn}:`, mlResults);

      // Store string values directly in database
      await runQuery(`
        UPDATE student_enrollments
        SET trend = ?, consistent = ?, risk = ?, attentiveness = ?
        WHERE student_id = ? AND subject = ? AND semester = ?
      `, [mlResults.trend, mlResults.consistency, mlResults.risk, mlResults.attentiveness, studentId, subject, semester]);

      console.log(`✅ Updated ML predictions for student ${studentRecord.usn}`);
      successCount++;

    } catch (error) {
      console.error(`❌ Failed to calculate ML for student ${studentRecord.student_id}:`, error.message);
      failureCount++;
    }
  }

  console.log(`🎯 ML Calculation Complete - Success: ${successCount}, Failed: ${failureCount}`);
  return { successCount, failureCount };
};

// Configure multer for attendance image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/attendance');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `attendance-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Mock face recognition function (ML removed)
const recognizeFacesInImage = async (imagePath, classStudents) => {
  try {
    // Mock recognition - randomly recognize 70-90% of students
    const recognizedStudents = classStudents
      .filter(() => Math.random() > 0.15)
      .map(student => ({
        studentId: student.id,
        confidence: 0.7 + Math.random() * 0.3
      }));

    // Create mock bounding boxes
    const mockBoundingBoxes = recognizedStudents.map((student, index) => ({
      x: (index % 3) * 0.3 + Math.random() * 0.1,
      y: Math.floor(index / 3) * 0.25 + Math.random() * 0.1,
      width: 0.15,
      height: 0.2,
      recognized: true,
      studentName: classStudents.find(s => s.id === student.studentId)?.name || 'Unknown',
      confidence: student.confidence
    }));

    return {
      recognizedStudents,
      accuracy: recognizedStudents.length / classStudents.length,
      boundingBoxes: mockBoundingBoxes
    };
  } catch (error) {
    console.error('Face recognition error:', error);
    return {
      recognizedStudents: [],
      accuracy: 0,
      boundingBoxes: []
    };
  }
};

// POST /api/attendance/session/create - Create attendance session
router.post('/session/create', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { classId, sectionId, subjectCode, subjectName, semester, sessionDate, sessionTime } = req.body;

    if (!classId || !sectionId || !subjectName || !semester || !sessionDate || !sessionTime) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    // Requirement 1.5: Check for existing active session on the same date
    const existingSession = await getRow(`
      SELECT id, status FROM attendance_sessions 
      WHERE teacher_id = ? AND class_id = ? AND section_id = ? AND subject_name = ? AND session_date = ? AND status != 'cancelled'
    `, [teacher.id, classId, sectionId, subjectName, sessionDate]);

    if (existingSession) {
      if (existingSession.status === 'active') {
        return res.status(409).json({ 
          message: 'An active attendance session already exists for this class, subject, and date. Please complete or cancel the existing session first.',
          existingSessionId: existingSession.id
        });
      } else if (existingSession.status === 'completed') {
        return res.status(409).json({ 
          message: 'Attendance has already been taken for this class, subject, and date. Use the edit function to modify existing records.',
          existingSessionId: existingSession.id
        });
      }
    }

    // Get total students in class for the specific subject
    const studentCount = await getRow(`
      SELECT COUNT(*) as count FROM students s
      JOIN student_enrollments se ON s.id = se.student_id
      WHERE se.class_id = ? AND se.section_id = ? AND se.subject = ? AND se.status = 'active' AND se.is_current = 1
    `, [classId, sectionId, subjectName]);

    // Get local timestamp in YYYY-MM-DD HH:MM:SS format
    const now = new Date();
    const localTimestamp = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');

    // Create attendance session
    const sessionResult = await runQuery(`
      INSERT INTO attendance_sessions 
      (teacher_id, class_id, section_id, subject_name, semester, session_date, session_time, total_students, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `, [teacher.id, classId, sectionId, subjectName, parseInt(semester), sessionDate, sessionTime, studentCount.count, localTimestamp]);

    res.status(201).json({
      sessionId: sessionResult.id,
      message: 'Attendance session created successfully'
    });

  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/attendance/capture - Process attendance with ML face recognition
router.post('/capture', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { semester, department, section, subject, images } = req.body;

    console.log('📸 Processing attendance capture...');
    console.log(`Filters: Semester=${semester}, Dept=${department}, Section=${section}, Subject=${subject}`);
    console.log(`Images received: ${images?.length || 0}`);

    if (!semester || !department || !section || !subject) {
      return res.status(400).json({ message: 'All filter parameters are required' });
    }

    if (!images || images.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    // Get enrolled students with embeddings
    const enrolledStudents = await getAllRows(`
      SELECT 
        s.id, 
        s.usn, 
        s.name,
        s.face_embeddings
      FROM students s
      JOIN student_enrollments se ON s.id = se.student_id
      WHERE se.class_id = ? 
        AND se.section_id = ? 
        AND se.semester = ?
        AND se.subject = ?
        AND se.enrollment_date <= date('now')
      ORDER BY s.name
    `, [department, section, parseInt(semester), subject]);

    console.log(`📚 Found ${enrolledStudents.length} enrolled students`);

    if (enrolledStudents.length === 0) {
      return res.status(404).json({ 
        message: 'No students enrolled for this class and subject',
        recognizedStudents: [],
        total_faces_detected: 0,
        total_students_recognized: 0
      });
    }

    // Parse embeddings and prepare for ML service
    const studentsWithEmbeddings = enrolledStudents.map(student => {
      let embedding = null;
      if (student.face_embeddings) {
        try {
          const embeddings = JSON.parse(student.face_embeddings);
          embedding = Array.isArray(embeddings) && embeddings.length > 0 ? embeddings[0] : null;
        } catch (e) {
          console.error(`Failed to parse embeddings for ${student.usn}`);
        }
      }
      return {
        id: student.id,
        usn: student.usn,
        name: student.name,
        embedding: embedding
      };
    }).filter(s => s.embedding !== null); // Only students with embeddings

    console.log(`🧠 ${studentsWithEmbeddings.length} students have face embeddings`);

    if (studentsWithEmbeddings.length === 0) {
      return res.status(400).json({ 
        message: 'No students have registered face embeddings. Please register students with face images first.',
        recognizedStudents: [],
        total_faces_detected: 0,
        total_students_recognized: 0
      });
    }

    // Call Python ML service for recognition
    console.log('📤 Sending to Python ML service...');
    
    let recognitionResult = null;
    let mlError = null;

    try {
      const mlResponse = await fetch('http://localhost:8000/recognize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          images: images, // Array of base64 images
          enrolled_students: studentsWithEmbeddings
        })
      });

      if (mlResponse.ok) {
        recognitionResult = await mlResponse.json();
        console.log(`✅ ML Recognition complete: ${recognitionResult.total_students_recognized} students recognized`);
      } else {
        const errorData = await mlResponse.json();
        mlError = errorData.detail || 'ML service error';
        console.error('❌ ML service error:', mlError);
      }
    } catch (error) {
      mlError = error.message;
      console.error('❌ Failed to connect to ML service:', error.message);
    }

    // If ML service failed, return error
    if (!recognitionResult) {
      return res.status(503).json({
        message: 'Face recognition service is unavailable. Please ensure the Python server is running.',
        mlError: mlError,
        recognizedStudents: [],
        total_faces_detected: 0,
        total_students_recognized: 0,
        fallbackMode: true
      });
    }

    // Save annotated images to disk
    let savedImagePaths = [];
    if (recognitionResult.processed_images && recognitionResult.processed_images.length > 0) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        
        // Create uploads/attendance directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), 'server', 'uploads', 'attendance');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const timestamp = Date.now();
        
        // Save ALL annotated images
        for (let i = 0; i < recognitionResult.processed_images.length; i++) {
          const filename = `attendance-${semester}-${department}-${section}-${timestamp}-${i + 1}.jpg`;
          const filepath = path.join(uploadDir, filename);
          
          // Convert base64 to buffer and save
          const base64Data = recognitionResult.processed_images[i].replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(filepath, buffer);
          
          // Store relative path
          savedImagePaths.push(`/uploads/attendance/${filename}`);
        }
        
        console.log(`💾 Saved ${savedImagePaths.length} annotated images`);
      } catch (saveError) {
        console.error('❌ Failed to save annotated images:', saveError);
        // Continue without images - not critical
      }
    }

    // Return recognition results with saved image paths (as JSON string for database)
    res.json({
      success: true,
      recognizedStudents: recognitionResult.recognized_students || [],
      total_faces_detected: recognitionResult.total_faces_detected || 0,
      total_students_recognized: recognitionResult.total_students_recognized || 0,
      processedImages: recognitionResult.processed_images || [],
      savedImagePath: savedImagePaths.length > 0 ? JSON.stringify(savedImagePaths) : null, // Store as JSON array
      thresholdUsed: recognitionResult.threshold_used || 0.6,
      message: recognitionResult.message || 'Recognition complete'
    });

  } catch (error) {
    console.error('Capture attendance error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// POST /api/attendance/submit - Submit attendance with all records
router.post('/submit', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    console.log('📨 Received attendance submission request');
    const { classId, sectionId, subjectName, semester, sessionDate, sessionTime, capturedImagePath, totalStudents, presentCount, absentCount, recognitionAccuracy, attendanceRecords } = req.body;
    
    console.log('📋 Request data:', {
      classId, sectionId, subjectName, semester, sessionDate, sessionTime,
      totalStudents, presentCount, absentCount, recognitionAccuracy,
      recordsCount: attendanceRecords?.length
    });

    if (!classId || !sectionId || !subjectName || !semester || !sessionDate || !sessionTime || !attendanceRecords) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      console.log('❌ Invalid attendance records');
      return res.status(400).json({ message: 'Attendance records are required' });
    }

    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      console.log('❌ Teacher record not found for user:', req.user.id);
      return res.status(404).json({ message: 'Teacher record not found' });
    }
    
    console.log('✅ Found teacher:', teacher.id);

    // Get local timestamp in YYYY-MM-DD HH:MM:SS format
    const now = new Date();
    const localTimestamp = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');

    // Create attendance session
    const sessionResult = await runQuery(`
      INSERT INTO attendance_sessions 
      (teacher_id, class_id, section_id, subject_name, semester, session_date, session_time, captured_image_path, total_students, present_count, absent_count, recognition_accuracy, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [teacher.id, classId, sectionId, subjectName, parseInt(semester), sessionDate, sessionTime, capturedImagePath || null, totalStudents, presentCount, absentCount, recognitionAccuracy, localTimestamp]);

    const sessionId = sessionResult.id;
    console.log('✅ Created attendance session:', sessionId);

    // Insert attendance records for each student
    console.log('📝 Inserting attendance records for session:', sessionId);
    console.log('📊 Total records to insert:', attendanceRecords.length);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const record of attendanceRecords) {
      try {
        const { studentId, status, confidence, reasonType, markedBy } = record;
        console.log(`🔍 Processing student: ${studentId}, status: ${status}, confidence: ${confidence}, markedBy: ${markedBy || 'system'}`);

        // Get student ID from USN
        const student = await getRow('SELECT id FROM students WHERE usn = ?', [studentId]);
        if (!student) {
          console.warn(`❌ Student ${studentId} not found in database, skipping`);
          failureCount++;
          continue;
        }

        console.log(`✅ Found student ID: ${student.id} for USN: ${studentId}`);

        // Get local timestamp for marked_at in YYYY-MM-DD HH:MM:SS format
        const now = new Date();
        const markedTimestamp = now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') + '-' +
          String(now.getDate()).padStart(2, '0') + ' ' +
          String(now.getHours()).padStart(2, '0') + ':' +
          String(now.getMinutes()).padStart(2, '0') + ':' +
          String(now.getSeconds()).padStart(2, '0');

        const insertResult = await runQuery(`
          INSERT INTO attendance_records 
          (session_id, student_id, status, confidence, reason_type, attentiveness, emotion, marked_by, marked_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [sessionId, student.id, status, confidence || null, reasonType || null, record.attentiveness || null, record.emotion || null, markedBy || 'system', markedTimestamp]);
        
        console.log(`✅ Inserted attendance record for student ${studentId}, record ID: ${insertResult.id}, markedBy: ${markedBy || 'system'}`);
        successCount++;
      } catch (recordError) {
        console.error(`❌ Error inserting record for student ${record.studentId}:`, recordError);
        failureCount++;
        continue;
      }
    }
    
    console.log(`📊 Attendance records insertion complete - Success: ${successCount}, Failed: ${failureCount}`);

    // Calculate and store ML predictions for all students in this session
    console.log('🤖 Starting ML predictions calculation for all students...');
    try {
      await calculateAndStoreMLPredictions(sessionId, semester, subjectName);
      console.log('✅ ML predictions calculated and stored successfully');
    } catch (mlError) {
      console.error('❌ ML predictions calculation failed (non-blocking):', mlError.message);
      // Don't fail the request if ML calculation fails
    }

    res.status(201).json({
      message: 'Attendance submitted successfully',
      sessionId: sessionId,
      recordsCount: attendanceRecords.length,
      successCount: successCount,
      failureCount: failureCount
    });

  } catch (error) {
    console.error('Submit attendance error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/attendance/sessions - Get attendance sessions
router.get('/sessions', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { classId, sectionId, date, semester, subject } = req.query;

    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    let query = `
      SELECT id, class_id, section_id, subject_name, semester, 
             session_date, session_time, total_students, present_count, absent_count,
             recognition_accuracy, status, created_at
      FROM attendance_sessions 
      WHERE teacher_id = ?
    `;
    const params = [teacher.id];

    if (classId) {
      query += ' AND class_id = ?';
      params.push(classId);
    }

    if (sectionId) {
      query += ' AND section_id = ?';
      params.push(sectionId);
    }

    if (semester) {
      query += ' AND semester = ?';
      params.push(semester);
    }

    if (subject) {
      query += ' AND subject_name = ?';
      params.push(subject);
    }

    if (date) {
      query += ' AND session_date = ?';
      params.push(date);
    }

    query += ' ORDER BY session_date DESC, session_time DESC LIMIT 100';

    const sessions = await getAllRows(query, params);

    res.json({ sessions });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/attendance/edit - Edit attendance records
router.put('/edit', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { sessionId, attendanceRecords, date } = req.body;

    if (!sessionId || !attendanceRecords || !Array.isArray(attendanceRecords)) {
      return res.status(400).json({ message: 'Session ID and attendance records are required' });
    }

    // Verify session exists and belongs to teacher
    const session = await getRow(`
      SELECT ats.*, t.user_id 
      FROM attendance_sessions ats 
      JOIN teachers t ON ats.teacher_id = t.id 
      WHERE ats.id = ?
    `, [sessionId]);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to modify this session' });
    }

    // Check if the selected date matches today's date (only allow editing today's attendance)
    const today = new Date().toISOString().split('T')[0];
    if (date !== today) {
      return res.status(403).json({ message: 'Can only edit attendance for today\'s date' });
    }

    let presentCount = 0;
    let absentCount = 0;

    // Update attendance records
    for (const record of attendanceRecords) {
      const { studentId, status, reasonType } = record;

      // Get student ID from USN
      const student = await getRow('SELECT id FROM students WHERE usn = ?', [studentId]);
      if (!student) {
        console.error(`Student not found for USN: ${studentId}`);
        continue;
      }

      await runQuery(`
        UPDATE attendance_records 
        SET status = ?, reason_type = ?, marked_by = 'manual', updated_at = CURRENT_TIMESTAMP
        WHERE session_id = ? AND student_id = ?
      `, [status, reasonType || null, sessionId, student.id]);

      if (status === 'present' || status === 'excused') {
        presentCount++;
      } else {
        absentCount++;
      }
    }

    // Update session with new counts
    await runQuery(`
      UPDATE attendance_sessions 
      SET present_count = ?, absent_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [presentCount, absentCount, sessionId]);

    res.json({ message: 'Attendance updated successfully' });

  } catch (error) {
    console.error('Edit attendance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attendance/session/:sessionId - Get specific session details
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get session details
    const session = await getRow(`
      SELECT ats.*, c.name as class_name, c.department
      FROM attendance_sessions ats
      JOIN classes c ON ats.dept = c.id
      WHERE ats.id = ?
    `, [sessionId]);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Get attendance records for this session
    const attendanceRecords = await getAllRows(`
      SELECT ar.*, s.usn, u.name as student_name
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.usn
      JOIN users u ON s.user_id = u.id
      WHERE ar.session_id = ?
      ORDER BY u.name
    `, [sessionId]);

    res.json({
      session,
      attendanceRecords
    });

  } catch (error) {
    console.error('Get session details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attendance/student/:studentId - Get student's attendance by date
router.get('/student/:studentId', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { date, semester } = req.query;

    // Verify student access (students can only see their own data)
    if (req.user.role === 'student') {
      const student = await getRow('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!student || student.id != studentId) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    let query = `
      SELECT ar.status, ar.reason, ar.reason_type, ar.marked_at,
             ats.subject_code, ats.subject_name, ats.session_date, ats.session_time
      FROM attendance_records ar
      JOIN attendance_sessions ats ON ar.session_id = ats.id
      WHERE ar.student_id = ?
    `;
    const params = [studentId];

    if (date) {
      query += ' AND ats.session_date = ?';
      params.push(date);
    }

    if (semester) {
      query += ' AND ats.semester = ?';
      params.push(semester);
    }

    query += ' ORDER BY ats.session_date DESC, ats.session_time DESC';

    const attendance = await getAllRows(query, params);

    res.json({ attendance });

  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attendance/records - Get attendance records with filters (returns ALL sessions for the date)
router.get('/records', authenticateToken, requireRole(['teacher']), async (req, res) => {
  try {
    const { classId, sectionId, semester, subject, date } = req.query;

    if (!classId || !sectionId || !semester || !subject) {
      return res.status(400).json({ message: 'Class ID, Section ID, Semester, and Subject are required' });
    }

    // Get teacher ID
    const teacher = await getRow('SELECT id FROM teachers WHERE user_id = ?', [req.user.id]);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher record not found' });
    }

    // Find ALL sessions for the given filters (not just one)
    // Note: We filter by teacher_id to ensure teacher only sees their own sessions
    let sessionQuery = `
      SELECT id, session_date, session_time, total_students, present_count, absent_count, captured_image_path, teacher_id
      FROM attendance_sessions 
      WHERE teacher_id = ? AND class_id = ? AND section_id = ? AND semester = ? AND subject_name = ?
    `;
    const sessionParams = [teacher.id, classId, sectionId, semester, subject];

    if (date) {
      sessionQuery += ' AND session_date = ?';
      sessionParams.push(date);
    }

    sessionQuery += ' ORDER BY session_time ASC';

    console.log('🔍 Fetching sessions with query:', sessionQuery);
    console.log('🔍 Query params:', sessionParams);
    console.log('🔍 Teacher ID:', teacher.id);

    const sessions = await getAllRows(sessionQuery, sessionParams);

    console.log('📊 Found sessions:', sessions.length);
    if (sessions.length > 0) {
      console.log('📊 Session times:', sessions.map(s => s.session_time));
      console.log('📊 Session IDs:', sessions.map(s => s.id));
    }

    if (!sessions || sessions.length === 0) {
      return res.status(404).json({ 
        message: 'No attendance session found for the selected filters',
        hasSession: false
      });
    }

    // Get attendance records for ALL sessions
    const sessionsWithRecords = await Promise.all(sessions.map(async (session) => {
      const attendanceRecords = await getAllRows(`
        SELECT ar.*, s.usn, s.name as student_name
        FROM attendance_records ar
        JOIN students s ON ar.student_id = s.id
        WHERE ar.session_id = ?
        ORDER BY s.name
      `, [session.id]);

      // Format the records for frontend
      const formattedRecords = attendanceRecords.map(record => ({
        id: record.usn,
        name: record.student_name,
        status: record.status,
        reasonType: record.reason_type || '',
        confidence: record.confidence,
        attentiveness: record.attentiveness || null,
        emotion: record.emotion || null,
        markedBy: record.marked_by || 'system',
        markedAt: record.marked_at
      }));

      return {
        session: {
          id: session.id,
          date: session.session_date,
          time: session.session_time,
          totalStudents: session.total_students,
          presentCount: session.present_count,
          absentCount: session.absent_count,
          capturedImagePath: session.captured_image_path || null,
          capturedImagePaths: session.captured_image_path ? (
            session.captured_image_path.startsWith('[') ? JSON.parse(session.captured_image_path) : [session.captured_image_path]
          ) : []
        },
        attendanceRecords: formattedRecords
      };
    }));

    res.json({
      sessions: sessionsWithRecords,
      hasSession: true,
      totalSessions: sessionsWithRecords.length
    });

  } catch (error) {
    console.error('Get attendance records error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/subjects - Get subjects by class/semester
router.get('/subjects', authenticateToken, async (req, res) => {
  try {
    const { classId, semester } = req.query;

    let query = 'SELECT * FROM subjects WHERE 1=1';
    const params = [];

    if (classId) {
      query += ' AND dept = ?';
      params.push(classId);
    }

    if (semester) {
      query += ' AND semester = ?';
      params.push(semester);
    }

    query += ' ORDER BY name';

    const subjects = await getAllRows(query, params);

    res.json({ subjects });

  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/attendance/student-daily - Get student's attendance for a specific date
router.get('/student-daily', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    // Only students can access this endpoint
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get student record
    const student = await getRow('SELECT * FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) {
      return res.status(404).json({ message: 'Student record not found' });
    }

    // Get attendance records for the student on the specified date
    const records = await getAllRows(`
      SELECT 
        ar.id,
        ar.status,
        ar.marked_at,
        ats.id as session_id,
        ats.subject_name as subject,
        ats.session_date,
        ats.session_time,
        ats.semester,
        ats.class_id,
        ats.section_id
      FROM attendance_records ar
      JOIN attendance_sessions ats ON ar.session_id = ats.id
      WHERE ar.student_id = ? AND ats.session_date = ?
      ORDER BY ats.session_time
    `, [student.id, date]);

    res.json({
      success: true,
      records: records
    });

  } catch (error) {
    console.error('Get student daily attendance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;