# Arquitectura

- `frontend/`: SPA ligera en HTML5, CSS3 y JavaScript Vanilla. `fetch` consume `/api`.
- `backend/src/app.js`: API REST, autenticación JWT, autorización por rol, validaciones, limitador de intentos y auditoría.
- `backend/src/db.js`: pool compartido `mssql`, consultas parametrizadas, health-check y cierre ordenado.
- `backend/database/schema.sql`: esquema T-SQL.
- `backend/.env`: secretos y configuración local (no versionar).

El servidor sirve el frontend y la API desde el mismo origen en `http://localhost:3000`. Roles: ADMIN, EMPLOYEE, MARKETING y CLIENT. El backend es la autoridad de permisos; ocultar navegación en el cliente no sustituye las comprobaciones API.

La autenticación usa JWT bearer con expiración; el cliente mantiene el token en `sessionStorage`. El endpoint logout es stateless: el frontend elimina el token. Para despliegue de mayor criticidad, sustituir por cookies HttpOnly/Secure/SameSite y estrategia de revocación/rotación de sesión.

La interfaz original incluida en el ZIP es parcial. No se recibieron los modelos/rutas originales completos, por lo que cualquier regla no reflejada en esos archivos requiere validación funcional con el dueño del proceso.
