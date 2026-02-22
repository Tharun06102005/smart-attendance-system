import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import { initializeDatabase } from "./database/connection.js";

// Import route modules
import authRoutes from "./routes/auth.js";
import studentRoutes from "./routes/students.js";
import teacherRoutes from "./routes/teachers.js";
import attendanceRoutes from "./routes/attendance.js";
import analyticsRoutes from "./routes/analytics.js";
import dashboardRoutes from "./routes/dashboard.js";
import timetableRoutes from "./routes/timetable.js";
import classesRoutes from "./routes/classes.js";
import dbmsValuesRoutes from "./routes/dbms-values.js";
import adminRoutes from "./routes/admin.js";
import systemRoutes from "./routes/system.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Enable CORS
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5000', 'http://localhost:3000'],
    credentials: true
  }));

  // Initialize database
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }

  // Register API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/teachers', teacherRoutes);
  app.use('/api/classes', classesRoutes); // Classes and sections endpoints
  app.use('/api/sections', studentRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/subjects', attendanceRoutes); // Subjects endpoint
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/timetable', timetableRoutes);
  app.use('/api/dbms-values', dbmsValuesRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/api/uploads', systemRoutes); // File serving endpoint
  app.use('/api/face', systemRoutes); // Face recognition endpoint

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // API documentation endpoint
  app.get('/api', (req, res) => {
    res.json({
      message: 'Attendance System API',
      version: '1.0.0',
      endpoints: {
        auth: '/api/auth',
        students: '/api/students',
        attendance: '/api/attendance',
        analytics: '/api/analytics',
        dashboard: '/api/dashboard',
        timetable: '/api/timetable',
        system: '/api/system'
      }
    });
  });

  return httpServer;
}
