@echo off
echo ========================================
echo   Python Environment Setup
echo ========================================
echo.

echo [1/3] Checking Python...
python --version
if errorlevel 1 (
    echo ❌ Python not found
    pause
    exit /b 1
)
echo ✅ Python found
echo.

echo [2/3] Creating virtual environment in myenv...
python -m venv myenv
if errorlevel 1 (
    echo ❌ Failed to create venv
    pause
    exit /b 1
)
echo ✅ Virtual environment created
echo.

echo [3/3] Installing packages from myenv\requirements.txt...
call myenv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r myenv\requirements.txt

if errorlevel 1 (
    echo ❌ Installation failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ✅ Setup Complete!
echo ========================================
echo.
echo Virtual environment: myenv\
echo Python ML code: server\ml\main.py
echo.
echo To run manually:
echo   myenv\Scripts\activate
echo   cd server\ml
echo   python main.py
echo.
echo Or use: npm run dev
echo.
pause
