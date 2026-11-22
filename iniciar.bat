@echo off
setlocal
cd /d "%~dp0"
if not exist "backend\.env" (
  echo No existe backend\.env. Ejecute instalar.bat y configure la conexion SQL.
  pause
  exit /b 1
)
call npm start
