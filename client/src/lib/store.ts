import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_BASE_URL } from './constants';

export type UserRole = 'teacher' | 'student' | 'admin';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  avatar?: string;
  // Teacher specific fields
  teacherId?: string;
  semesters?: string[];
  departments?: string[];
  sections?: string[];
  subjects?: string[];
  // Student specific fields
  usn?: string;
  semester?: number;
  department?: string;
  dept?: string;
  sectionId?: string;
  subject?: string;
}

export interface Student {
  id: string; // USN
  name: string;
  dept: string; // e.g., "CS"
  sectionId: string; // e.g., "A"
  faceImages: string[]; // base64 data URIs
  isRegistered: boolean;
}

export type AttendanceStatus = 'present' | 'absent';
export type EngagementLevel = 'active' | 'partial' | 'low';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  reason?: string; // For manual overrides
  proof?: string; // base64
  engagement?: EngagementLevel;
}

export interface AttendanceSession {
  id: string;
  teacherId: string;
  classId: string;
  sectionId: string;
  subject: string;
  date: string;
  timestamp: number;
  submitted: boolean;
}

interface AppState {
  currentUser: User | null;
  students: Student[];
  sessions: AttendanceSession[];
  attendanceRecords: AttendanceRecord[];

  // Actions
  login: (username: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  registerStudent: (student: Student) => void;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  
  createSession: (session: Omit<AttendanceSession, 'id' | 'timestamp' | 'submitted'>) => string;
  submitSession: (sessionId: string, records: Omit<AttendanceRecord, 'id' | 'sessionId'>[]) => void;
  
  getStudentStats: (studentId: string) => { total: number; present: number; absent: number; percentage: number };
  
  // API integration methods
  fetchStudents: (classId: string, sectionId: string) => Promise<void>;
  initializeUser: () => Promise<void>;
  editAttendance: (sessionId: string, attendanceRecords: any[], date: string) => Promise<boolean>;
}

// API helper functions
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || 'API call failed');
  }

  return response.json();
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      students: [],
      sessions: [],
      attendanceRecords: [],

      login: async (username, password, role) => {
        try {
          const response = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password, role }),
          });

          if (response.token && response.user) {
            localStorage.setItem('token', response.token);
            set({ currentUser: response.user });
            return true;
          }
          return false;
        } catch (error) {
          console.error('Login error:', error);
          return false;
        }
      },

      logout: async () => {
        try {
          await apiCall('/auth/logout', { method: 'POST' });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          localStorage.removeItem('token');
          set({ currentUser: null, students: [], sessions: [], attendanceRecords: [] });
        }
      },

      registerStudent: (student) =>
        set((state) => ({ students: [...state.students, student] })),

      updateStudent: (id, updates) =>
        set((state) => ({
          students: state.students.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),
        
      deleteStudent: (id) =>
        set((state) => ({
          students: state.students.filter((s) => s.id !== id),
        })),

      createSession: (sessionData) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newSession: AttendanceSession = {
          ...sessionData,
          id,
          timestamp: Date.now(),
          submitted: false,
        };
        set((state) => ({ sessions: [...state.sessions, newSession] }));
        return id;
      },

      submitSession: (sessionId, records) => {
        set((state) => {
           // update session to submitted
           const updatedSessions = state.sessions.map(s => s.id === sessionId ? {...s, submitted: true} : s);
           
           const newRecords = records.map(r => ({
             ...r,
             id: Math.random().toString(36).substr(2, 9),
             sessionId
           }));

           return {
             sessions: updatedSessions,
             attendanceRecords: [...state.attendanceRecords, ...newRecords]
           };
        });
      },

      getStudentStats: (studentId) => {
        const state = get();
        const records = state.attendanceRecords.filter(r => r.studentId === studentId);
        const total = records.length;
        const present = records.filter(r => r.status === 'present').length;
        const absent = total - present;
        const percentage = total === 0 ? 0 : Math.round((present / total) * 100);
        return { total, present, absent, percentage };
      },

      fetchStudents: async (classId, sectionId) => {
        try {
          const response = await apiCall(`/students/by-class/${classId}/${sectionId}`);
          if (response.students) {
            const formattedStudents = response.students.map((student: any) => ({
              id: student.usn,
              name: student.name,
              dept: student.dept,
              sectionId: student.section_id,
              faceImages: [],
              isRegistered: true
            }));
            set({ students: formattedStudents });
          }
        } catch (error) {
          console.error('Fetch students error:', error);
        }
      },

      initializeUser: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
          const response = await apiCall('/auth/me');
          if (response.user) {
            set({ currentUser: response.user });
          }
        } catch (error) {
          console.error('Initialize user error:', error);
          localStorage.removeItem('token');
        }
      },

      editAttendance: async (sessionId, attendanceRecords, date) => {
        try {
          const response = await apiCall('/attendance/edit', {
            method: 'PUT',
            body: JSON.stringify({
              sessionId,
              attendanceRecords,
              date
            }),
          });

          return true;
        } catch (error) {
          console.error('Edit attendance error:', error);
          throw error;
        }
      },
    }),
    {
      name: 'sap-storage', // local storage key
      partialize: (state) => ({ 
        currentUser: state.currentUser,
        // Don't persist students, sessions, attendanceRecords - fetch from API
      }),
    }
  )
);
