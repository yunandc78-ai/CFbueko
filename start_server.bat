@echo off
title Bolu Bu Eko - Cashflow Manager & SQLite Server
color 0e
cls

echo ===================================================================
echo     BOLU BU EKO - CASHFLOW MANAGER ^& SQLITE SERVER
echo ===================================================================
echo.

:: Detect Python executable
set "PYTHON_EXE="

if exist "C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe" (
    set "PYTHON_EXE=C:\Users\User\AppData\Local\Programs\Python\Python312\python.exe"
    goto :found_python
)

for /f "tokens=*" %%i in ('where python 2^>nul') do (
    set "PYTHON_EXE=%%i"
    goto :found_python
)

for /f "tokens=*" %%i in ('where py 2^>nul') do (
    set "PYTHON_EXE=%%i"
    goto :found_python
)

:found_python
if "%PYTHON_EXE%"=="" (
    color 0c
    echo [ERROR] Python tidak ditemukan di komputer ini!
    echo Harap install Python terlebih dahulu atau jalankan index.html langsung di browser.
    echo.
    pause
    exit /b 1
)

echo [*] Menggunakan Python: %PYTHON_EXE%
echo [*] Lokasi database  : bolu_bu_eko.db
echo [*] Memulai server di: http://localhost:5000 ...
echo.

:: Open browser automatically after a short delay
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5000"

:: Start the Python server
"%PYTHON_EXE%" server.py

pause

