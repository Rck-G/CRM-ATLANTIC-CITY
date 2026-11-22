@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo   CRM ATLANTIC CITY - INSTALADOR
echo ============================================
where node >nul 2>nul
if errorlevel 1 (echo Instale Node.js LTS desde https://nodejs.org/ & pause & exit /b 1)
where npm >nul 2>nul
if errorlevel 1 (echo npm no esta disponible. & pause & exit /b 1)
node -e "const v=process.versions.node.split('.')[0];if(+v<18)process.exit(1)"
if errorlevel 1 (echo Se requiere Node.js 18 o superior. & pause & exit /b 1)
if not exist "backend\.env" (
 copy "backend\.env.example" "backend\.env" >nul
 echo Se creo backend\.env. Edite servidor, puerto, usuario, password y JWT_SECRET.
)
echo Instalando dependencias...
call npm install
if errorlevel 1 (echo Fallo npm install. & pause & exit /b 1)
echo.
echo PASO PENDIENTE: ejecute backend\database\schema.sql en SSMS.
echo Luego cree el login crm_app y configure backend\.env.
echo Consulte docs\INSTALACION.md.
pause
