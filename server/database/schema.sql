-- Attendance System Database Schema
-- SQLite Database for Academic Project

-- NOTE: This schema uses CREATE TABLE IF NOT EXISTS to preserve existing data
-- Only run DROP statements manually if you want to reset the entire database

-- Users table (Admin, Teachers, Students)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    phone_no VARCHAR(15),
    created_at DATETIME
);

-- Students table (extends users) - Permanent student identity
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    usn VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL,
    face_embeddings TEXT, -- JSON array of face embeddings
    captured_image_path VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Student Enrollments table - Tracks enrollment history across semesters
CREATE TABLE IF NOT EXISTS student_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    class_id VARCHAR(10) NOT NULL,
    section_id VARCHAR(10) NOT NULL,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    subject VARCHAR(100) NOT NULL,
    enrollment_date DATETIME DEFAULT (datetime('now', 'localtime')),
    completion_date DATETIME,
    trend VARCHAR(50) DEFAULT NULL,
    consistent VARCHAR(50) DEFAULT NULL,
    risk VARCHAR(50) DEFAULT NULL,
    attentiveness VARCHAR(50) DEFAULT NULL,
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Teachers table (extends users) - Permanent teacher identity
CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    teacher_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Teacher Enrollments table - Tracks teaching assignments across semesters
CREATE TABLE IF NOT EXISTS teacher_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    class_id VARCHAR(10) NOT NULL,
    section_id VARCHAR(10) NOT NULL,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    subject VARCHAR(100) NOT NULL,
    enrollment_date DATETIME DEFAULT (datetime('now', 'localtime')),
    completion_date DATETIME,
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Timetable - Stores class schedule
-- 
-- HOW TO USE THIS TABLE:
-- 1. Select the correct SEMESTER (1-8) for your class
-- 2. Enter DEPARTMENT code (e.g., 'CS', 'EC', 'ME')
-- 3. Enter SECTION (e.g., 'A', 'B', 'C')
-- 4. Enter SUBJECT name exactly as it appears in your curriculum
-- 5. IMPORTANT: Select DAY_OF_WEEK from dropdown BEFORE adding entries
--    - Available days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday
--    - ALWAYS verify the selected day before clicking "Add Entry"
--    - If you accidentally add to wrong day, use the edit/delete buttons to fix
-- 6. Enter START_TIME in 24-hour format (e.g., 09:00, 14:30)
-- 7. Enter END_TIME in 24-hour format (e.g., 09:55, 15:25)
-- 8. DATE field is optional (leave empty for recurring weekly schedule)
--
-- COMMON MISTAKES TO AVOID:
-- ❌ Forgetting to change day_of_week dropdown before adding multiple entries
-- ❌ Using 12-hour format (use 09:00 not 9:00 AM)
-- ❌ Adding duplicate entries for the same time slot
-- ✓ Always double-check the day_of_week dropdown is set correctly
-- ✓ Review the timetable after adding entries to verify correctness
-- ✓ Use the "Manage Timetable" page to view/edit/delete entries
--
CREATE TABLE IF NOT EXISTS timetable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
    department VARCHAR(10) NOT NULL,
    section VARCHAR(10) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    day_of_week VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    date DATE DEFAULT NULL
);

-- Attendance Sessions table
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    class_id VARCHAR(10) NOT NULL,
    section_id VARCHAR(10) NOT NULL,
    subject_name VARCHAR(100),
    semester INTEGER NOT NULL,
    session_date DATE NOT NULL,
    session_time TIME NOT NULL,
    captured_image_path VARCHAR(255),
    total_students INTEGER DEFAULT 0,
    present_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    recognition_accuracy DECIMAL(5,2),
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Attendance Records table
CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'excused', 'late')),
    confidence DECIMAL(5,2),
    emotion VARCHAR(50) DEFAULT NULL,
    attentiveness VARCHAR(50) DEFAULT NULL,
    reason_type VARCHAR(100),
    marked_by VARCHAR(20) DEFAULT 'system',
    marked_at DATETIME DEFAULT (datetime('now', 'localtime')),
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (session_id) REFERENCES attendance_sessions(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Indexes for better performance
-- Single column indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_students_usn ON students(usn);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_class_section ON student_enrollments(class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_semester ON student_enrollments(semester);
CREATE INDEX IF NOT EXISTS idx_teacher_enrollments_teacher ON teacher_enrollments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_enrollments_class_section ON teacher_enrollments(class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_teacher_enrollments_semester ON teacher_enrollments(semester);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class ON attendance_sessions(class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_id);

-- Composite indexes for optimized multi-column queries
-- Student Enrollments: Most common query pattern (class + section + subject)
CREATE INDEX IF NOT EXISTS idx_enrollments_class_section_subject 
ON student_enrollments(class_id, section_id, subject);

-- Student Enrollments: Student history queries (student + semester)
CREATE INDEX IF NOT EXISTS idx_enrollments_student_semester 
ON student_enrollments(student_id, semester);

-- Student Enrollments: Enrollment date lookups for duplicate prevention
CREATE INDEX IF NOT EXISTS idx_enrollments_student_date 
ON student_enrollments(student_id, enrollment_date);

-- Teacher Enrollments: Assignment validation (teacher + semester + class + section + subject)
CREATE INDEX IF NOT EXISTS idx_teacher_enrollments_full 
ON teacher_enrollments(teacher_id, semester, class_id, section_id, subject);

-- Teacher Enrollments: Enrollment date lookups
CREATE INDEX IF NOT EXISTS idx_teacher_enrollments_date 
ON teacher_enrollments(teacher_id, enrollment_date);

-- Attendance Sessions: Duplicate session check (teacher + class + section + subject + date)
CREATE INDEX IF NOT EXISTS idx_attendance_session_lookup 
ON attendance_sessions(teacher_id, class_id, section_id, subject_name, session_date);

-- Attendance Sessions: Query by class, section, semester, subject
CREATE INDEX IF NOT EXISTS idx_attendance_session_filters 
ON attendance_sessions(class_id, section_id, semester, subject_name);

-- Attendance Records: Student attendance history (student + session)
CREATE INDEX IF NOT EXISTS idx_attendance_student_session 
ON attendance_records(student_id, session_id);

-- Insert default admin user (password: admin123)
INSERT OR IGNORE INTO users (username, password_hash, role, name, email) VALUES 
('admin', '$2a$10$hFzTcy9vhCKIf4gitiqFauuL2JHhdwTCYnHE2bUvfVHxtWLvMOnke', 'admin', 'System Administrator', 'admin@system.local');