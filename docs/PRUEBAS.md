# Registro de verificación ejecutada

## Ejecutado en el entorno de construcción
- `node --check backend/src/app.js`: correcto.
- `node --check backend/src/db.js`: correcto.
- `node --check backend/scripts/seed-demo.js`: correcto.
- `node --check frontend/js/app.js`: correcto.
- `npm run check`: correcto.
- Revisión estática del archivo SQL y de la configuración `.env.example`.

## No ejecutado / requiere entorno Windows y SQL Server
- `npm install` y ejecución real de dependencias.
- Conexión autenticada a SQL Server Express/Developer.
- Ejecución del DDL en SQL Server 2019+.
- Pruebas de login, bootstrap, CRUD, roles, transacciones, reservas y reportes contra una base real.
- Verificación visual responsive en navegadores y pruebas de aceptación de todos los módulos.
- Ejecución real de `npm run seed:demo` y autenticación con las cuentas ficticias; requiere una instancia SQL Server configurada.

No se declara que estas pruebas se hayan realizado. Deben ejecutarse con una instancia SQL Server disponible y datos de prueba autorizados antes de producción.
