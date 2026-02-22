# 🎓 Smart Attendance System

An AI-powered attendance management system with facial recognition, advanced analytics, and comprehensive reporting capabilities for educational institutions.

## ✨ Features

### 🤖 AI-Powered Attendance
- **Facial Recognition**: Advanced face detection using DeepFace with RetinaFace detector
- **Real-time Processing**: FastAPI-based ML service for instant attendance marking
- **Multiple Recognition Models**: Facenet512 for 512-dimensional embeddings
- **Manual Attendance**: Backup option for traditional attendance marking

### 📊 Advanced Analytics
- **Trend Analysis**: Attendance pattern identification and visualization
- **Risk Prediction**: ML-based prediction of students at risk of poor attendance
- **Consistency Analysis**: Track attendance regularity patterns
- **Attentiveness Metrics**: Behavioral analysis during class sessions
- **Interactive Dashboards**: Real-time charts and insights using Recharts

### 👥 User Management
- **Role-Based Access Control**: Admin, Teacher, and Student roles
- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **Teacher Registration**: Self-service teacher signup and approval workflow
- **Student Management**: Comprehensive student database management

### 📅 Timetable & Scheduling
- **Class Scheduling**: Create and manage academic timetables
- **Teacher Assignments**: Assign teachers to specific classes and subjects
- **Room Management**: Track classroom allocations and availability

### 🎨 Modern UI/UX
- **Responsive Design**: Mobile-friendly interface using TailwindCSS
- **Component Library**: Built with Radix UI for accessibility
- **Dark Mode Support**: Theme switching with next-themes
- **Smooth Animations**: Framer Motion for enhanced user experience

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **React 19** with TypeScript for type safety
- **Vite** for fast development and building
- **Wouter** for lightweight routing
- **Zustand** for state management
- **TanStack Query** for server state management
- **Radix UI** components for accessible UI

### Backend (Node.js + Express)
- **Express.js** RESTful API
- **SQLite3** database for data persistence
- **JWT** for secure authentication
- **Multer** for file upload handling
- **CORS** enabled for cross-origin requests

### ML Services (Python + FastAPI)
- **FastAPI** for high-performance ML API
- **DeepFace** for facial recognition
- **OpenCV** for image processing
- **NumPy** for numerical computations
- **Multiple ML Models** for different analytics

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.8 or higher)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Tharun06102005/smart-attendance-system
   cd attendance-system
