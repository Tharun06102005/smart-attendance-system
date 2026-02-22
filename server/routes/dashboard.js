import express from 'express';
import { runQuery, getRow, getAllRows } from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/dashboard/summary - Overall dashboard data
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;

    if (userRole === 'teacher') {
      // Teacher dashboard data
      const teacher = await getRow('SELECT * FROM teachers WHERE user_id = ?', [req.user.id]);
      
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher record not found' });
      }

      // Get total students taught by this teacher
      const totalStudentsResult = await getRow(`
        SELECT COUNT(DISTINCT s.id) as count
        FROM students s
        JOIN student_enrollments se ON s.id = se.student_id
        JOIN attendance_sessions ats ON se.dept = ats.dept AND se.section_id = ats.section_id
        WHERE ats.teacher_id = ? AND se.status = 'active' AND se.is_current = 1
      `, [teacher.id]);

      // Get today's attendance sessions
      const today = new Date().toISOString().split('T')[0];
      const todayAttendance = await getAllRows(`
        SELECT ats.*, c.name as class_name
        FROM attendance_sessions ats
        JOIN classes c ON ats.dept = c.id
        WHERE ats.teacher_id = ? AND ats.session_date = ?
        ORDER BY ats.session_time DESC
      `, [teacher.id, today]);

      // Calculate today's attendance percentage
      let todayPercentage = 0;
      if (todayAttendance.length > 0) {
        const totalPresent = todayAttendance.reduce((sum, session) => sum + (session.present_count || 0), 0);
        const totalStudents = todayAttendance.reduce((sum, session) => sum + (session.total_students || 0), 0);
        todayPercentage = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;
      }

      // Get weekly trends (last 7 days)
      const weeklyTrends = await getAllRows(`
        SELECT 
          ats.session_date,
          COUNT(*) as sessions,
          AVG(CAST(ats.present_count AS FLOAT) / CAST(ats.total_students AS FLOAT) * 100) as avg_percentage
        FROM attendance_sessions ats
        WHERE ats.teacher_id = ? 
          AND ats.session_date >= date('now', '-7 days')
          AND ats.status = 'completed'
        GROUP BY ats.session_date
        ORDER BY ats.session_date
      `, [teacher.id]);

      // Get recent sessions
      const recentSessions = await getAllRows(`
        SELECT ats.*, c.name as class_name
        FROM attendance_sessions ats
        JOIN classes c ON ats.dept = c.id
        WHERE ats.teacher_id = ?
        ORDER BY ats.created_at DESC
        LIMIT 5
      `, [teacher.id]);

      // Get current enrollments for teacher
      const currentEnrollments = await getAllRows(
        'SELECT DISTINCT semester, subject FROM teacher_enrollments WHERE teacher_id = ?',
        [teacher.id]
      );
      
      const semesters = [...new Set(currentEnrollments.map(e => e.semester.toString()))];
      const subjects = [...new Set(currentEnrollments.map(e => e.subject))];

      res.json({
        teacherInfo: {
          name: req.user.name,
          teacherId: teacher.teacher_id,
          semesters: semesters,
          subjects: subjects
        },
        totalStudents: totalStudentsResult.count || 0,
        todayAttendance: {
          sessions: todayAttendance.length,
          percentage: Math.round(todayPercentage * 100) / 100
        },
        weeklyTrends: weeklyTrends.map(trend => ({
          date: trend.session_date,
          sessions: trend.sessions,
          percentage: Math.round((trend.avg_percentage || 0) * 100) / 100
        })),
        recentSessions: recentSessions.map(session => ({
          id: session.id,
          className: session.class_name,
          section: session.section_id,
          subject: session.subject_name,
          date: session.session_date,
          time: session.session_time,
          status: session.status,
          presentCount: session.present_count,
          totalStudents: session.total_students
        }))
      });

    } else if (userRole === 'student') {
      // Student dashboard data
      const student = await getRow('SELECT * FROM students WHERE user_id = ?', [req.user.id]);
      
      if (!student) {
        return res.status(404).json({ message: 'Student record not found' });
      }

      // Get most recent enrollment (latest semester)
      const enrollment = await getRow(
        'SELECT * FROM student_enrollments WHERE student_id = ? ORDER BY semester DESC, created_at DESC LIMIT 1',
        [student.id]
      );

      if (!enrollment) {
        return res.status(404).json({ message: 'No enrollment found' });
      }

      // Get overall attendance percentage
      const overallStats = await getRow(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN ar.status IN ('present', 'excused') THEN 1 ELSE 0 END) as present
        FROM attendance_records ar
        WHERE ar.student_id = ?
      `, [student.id]);

      const overallPercentage = overallStats.total > 0 ? 
        (overallStats.present / overallStats.total) * 100 : 0;

      // Get today's classes
      const today = new Date().toISOString().split('T')[0];
      const todayClasses = await getAllRows(`
        SELECT 
          ats.subject_name,
          ats.session_time,
          ar.status
        FROM attendance_sessions ats
        LEFT JOIN attendance_records ar ON ats.id = ar.session_id AND ar.student_id = ?
        WHERE ats.class_id = ? AND ats.section_id = ? AND ats.session_date = ?
        ORDER BY ats.session_time
      `, [student.id, enrollment.class_id, enrollment.section_id, today]);

      // Get upcoming classes (mock data - in real implementation, you'd have a timetable)
      const upcomingClasses = [
        { subject: 'Mathematics', time: '10:00 AM', room: 'Room 101' },
        { subject: 'Physics', time: '11:30 AM', room: 'Lab 201' },
        { subject: 'Computer Science', time: '2:00 PM', room: 'Room 301' }
      ];

      // Generate alerts based on attendance
      const alerts = [];
      if (overallPercentage < 75) {
        alerts.push({
          type: 'warning',
          message: `Your attendance is ${Math.round(overallPercentage)}%. You need to maintain at least 75% attendance.`
        });
      }

      // Check for recent absences
      const recentAbsences = await getRow(`
        SELECT COUNT(*) as count
        FROM attendance_records ar
        JOIN attendance_sessions ats ON ar.session_id = ats.id
        WHERE ar.student_id = ? 
          AND ar.status = 'absent' 
          AND ats.session_date >= date('now', '-7 days')
      `, [student.id]);

      if (recentAbsences.count >= 3) {
        alerts.push({
          type: 'error',
          message: `You have ${recentAbsences.count} absences in the last week. Please contact your teacher.`
        });
      }

      res.json({
        studentInfo: {
          name: req.user.name,
          usn: student.usn,
          semester: enrollment.semester,
          department: student.department,
          dept: enrollment.class_id,
          sectionId: enrollment.section_id,
          subject: enrollment.subject
        },
        overallPercentage: Math.round(overallPercentage * 100) / 100,
        totalClasses: overallStats.total,
        presentClasses: overallStats.present,
        todayClasses: todayClasses.map(cls => ({
          subject: cls.subject_name,
          time: cls.session_time,
          status: 'scheduled'
        })),
        upcomingClasses,
        alerts
      });

    } else {
      // Admin dashboard (basic implementation)
      const totalStudents = await getRow('SELECT COUNT(*) as count FROM students');
      const totalTeachers = await getRow('SELECT COUNT(*) as count FROM teachers');
      const totalSessions = await getRow('SELECT COUNT(*) as count FROM attendance_sessions');

      res.json({
        totalStudents: totalStudents.count,
        totalTeachers: totalTeachers.count,
        totalSessions: totalSessions.count,
        systemStatus: 'operational'
      });
    }

  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;