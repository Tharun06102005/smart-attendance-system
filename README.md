
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
   git clone [https://github.com/Tharun06102005/smart-attendance-system](https://github.com/Tharun06102005/smart-attendance-system)
   cd attendance-system



2. **Install Node.js dependencies**
```bash
npm install

```


3. **Setup Python environment** (Windows)
```bash
setup-python.bat

```


4. **Start the development server**
```bash
npm run dev

```


Or use the automated startup script:
```bash
start-system.bat

```



### Access Points

* **Frontend**: http://localhost:3000
* **Backend API**: http://localhost:5000
* **ML Service**: http://localhost:8000

## 📁 Project Structure

```
attendance-system/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── lib/            # Utilities and stores
│   │   └── App.tsx         # Main application component
│   └── public/             # Static assets
├── server/                 # Node.js backend
│   ├── database/           # SQLite database files
│   ├── ml/                 # Python ML services
│   │   ├── main.py         # FastAPI ML service
│   │   ├── model1_trend_analysis.py
│   │   ├── model2_risk_prediction.py
│   │   ├── model3_consistency_analysis.py
│   │   └── model4_attentiveness_analysis.py
│   ├── routes/             # API route handlers
│   ├── middleware/         # Express middleware
│   └── uploads/            # File upload storage
├── myenv/                  # Python virtual environment
├── setup-python.bat        # Python environment setup
├── start-system.bat        # Automated startup script
└── package.json            # Node.js dependencies

```

## 🔧 Available Scripts

### Development

* `npm run dev` - Start all services (client, server, ML)
* `npm run dev:client` - Start React development server
* `npm run dev:server` - Start Express server
* `npm run dev:python` - Start Python ML service

### Production

* `npm run build` - Build React application
* `npm run preview` - Preview production build
* `npm run server` - Start production server

### Utilities

* `npm run check` - TypeScript type checking

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your-super-secret-jwt-key
DATABASE_URL=./server/database/attendance.db

```

## 🤖 ML Models

The system includes four specialized ML models:

1. **Trend Analysis** (model1_trend_analysis.py)
* Identifies attendance patterns over time
* Predicts future attendance trends


2. **Risk Prediction** (model2_risk_prediction.py)
* Identifies students at risk of poor attendance
* Provides early warning system


3. **Consistency Analysis** (model3_consistency_analysis.py)
* Analyzes attendance regularity
* Detects anomalous patterns


4. **Attentiveness Analysis** (model4_attentiveness_analysis.py)
* Behavioral analysis during classes
* Engagement metrics



## 📊 API Endpoints

### Authentication

* `POST /api/auth/login` - User login
* `POST /api/auth/register` - Teacher registration
* `GET /api/auth/me` - Get current user

### Attendance

* `POST /api/attendance/mark` - Mark attendance
* `GET /api/attendance/records` - Get attendance records
* `POST /api/attendance/facial-recognition` - Face recognition

### Analytics

* `GET /api/analytics/trends` - Attendance trends
* `GET /api/analytics/risk` - Risk predictions
* `GET /api/analytics/consistency` - Consistency analysis

### Management

* `GET /api/students` - Student management
* `GET /api/timetable` - Timetable management
* `POST /api/upload` - File uploads

## 🎯 Key Technologies

### Frontend Stack

* **React 19** - UI framework
* **TypeScript** - Type safety
* **Vite** - Build tool
* **TailwindCSS** - Styling
* **Radix UI** - Component library
* **Wouter** - Routing
* **Zustand** - State management
* **TanStack Query** - Data fetching
* **Framer Motion** - Animations

### Backend Stack

* **Node.js** - Runtime
* **Express** - Web framework
* **SQLite3** - Database
* **JWT** - Authentication
* **bcryptjs** - Password hashing
* **Multer** - File uploads

### ML/AI Stack

* **Python** - ML language
* **FastAPI** - ML API framework
* **DeepFace** - Face recognition
* **OpenCV** - Image processing
* **NumPy** - Numerical computing
* **PIL** - Image manipulation

## 🔒 Security Features

* **JWT Authentication** - Secure token-based authentication
* **Password Hashing** - bcrypt for secure password storage
* **CORS Protection** - Configurable cross-origin access
* **File Upload Security** - Validated file uploads with size limits
* **Input Validation** - Zod schema validation
* **SQL Injection Protection** - Parameterized queries

## 📈 Performance Optimizations

* **Model Caching** - Pre-loaded ML models for faster inference
* **Image Optimization** - Efficient image processing with Pica
* **Lazy Loading** - React components loaded on demand
* **API Caching** - Query result caching with TanStack Query
* **Bundle Optimization** - Vite's optimized bundling

## 🧪 Testing

The project includes test files for ML models:

* `test-model1-trend.py` - Trend analysis testing
* `test-model2-risk.py` - Risk prediction testing
* `test-model3-consistency.py` - Consistency analysis testing
* `test-model4-attentiveness.py` - Attentiveness analysis testing
* `test-train-model.py` - Model training validation

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support and questions:

* Create an issue in the repository
* Check the documentation
* Review the test files for usage examples

---

**Built with ❤️ for modern education management**

```

```
