@echo off
echo 🚀 Starting Attendance System...
echo.

echo [1/3] 🐍 Starting Python ML Service...
start "Python ML" cmd /k "cd server\ml && ..\..\myenv\Scripts\activate && python main.py"
timeout /t 3 /nobreak > nul

echo [2/3] 🔧 Starting Node.js Backend...
start "Backend" cmd /k "npm run dev:server"
timeout /t 5 /nobreak > nul

echo [3/3] 🌐 Starting Frontend...
start "Frontend" cmd /k "npm run dev:client"

echo.
echo ✅ All services started!
echo.
echo 📍 URLs:
echo   Frontend: http://localhost:3000
echo   Backend: http://localhost:5000
echo   Python ML: http://localhost:8000
echo.
echo 🔑 Login: admin / admin123
echo.
pause