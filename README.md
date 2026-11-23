# CRM Atlantic City

Sistema CRM web desarrollado con Node.js, Express y Microsoft SQL Server (`mssql`) en el backend, e interfaz gráfica construida con JavaScript Vanilla, HTML5 y CSS3.

---

## 🚀 Inicio Rápido (Windows)

1. **Requisitos previos:** Tener instalado Node.js LTS, SQL Server 2019+ (Express o Developer) y SSMS (SQL Server Management Studio).
2. **Instalación de dependencias:** Ejecuta `instalar.bat` o `npm install` dentro de la carpeta `backend`.
3. **Base de Datos:**
   - En SSMS, abre y ejecuta `backend/database/schema.sql` con una cuenta administrativa. Esto creará la base de datos `crm_atlantic_city`.
   - Crea el login y usuario de la aplicación siguiendo la guía en `docs/BASE_DATOS.md`.
4. **Variables de entorno:** Copia `backend/.env.example` a `backend/.env` y ajusta las credenciales de conexión.
5. **Carga de datos demo (Opcional - Solo Desarrollo):**
   - En **PowerShell**: `$env:SEED_DEMO_DATA="true"; npm run seed:demo`
   - En **CMD**: `set SEED_DEMO_DATA=true && npm run seed:demo`
6. **Ejecución:** Ejecuta `iniciar.bat` (o `npm start` en `backend`) y abre [http://localhost:3000](http://localhost:3000) en el navegador.

> **Nota de Salud:** La API cuenta con un endpoint de diagnóstico (`GET /api/health`). Si SQL Server no responde o la conexión falla, devolverá un estado HTTP `503`.

---

## 🔑 Cuentas Demo y Credenciales

La carga de datos ficticios es idempotente y está deshabilitada por defecto en producción (`NODE_ENV=production`).

### Usuarios Internos (Gestión)

| Rol                    | Usuario / Correo                | Contraseña           |
| ---------------------- | ------------------------------- | -------------------- |
| Administrador          | `admin@demo.atlantic.local`     | `DemoAdmin#2026`     |
| Gerencia / Operaciones | `manager@demo.atlantic.local`   | `DemoManager#2026`   |
| Marketing              | `marketing@demo.atlantic.local` | `DemoMarketing#2026` |

### Clientes de Prueba

| Cliente          | Usuario / Correo                       | Contraseña        |
| ---------------- | -------------------------------------- | ----------------- |
| Lucía Ramírez    | `lucia.ramirez@demo.atlantic.local`    | `DemoCliente#101` |
| Mateo Fernández  | `mateo.fernandez@demo.atlantic.local`  | `DemoCliente#102` |
| Valentina Torres | `valentina.torres@demo.atlantic.local` | `DemoCliente#103` |

### Datos incluidos en la semilla (Seed)

Al ejecutar el script de demo se cargan automáticamente:

- 3 Campañas y 3 Beneficios vinculados.
- 3 Restaurantes y 3 Reservas activas.
- 3 Eventos programados y 3 Inscripciones.
- 3 Ventas, 3 Tickets y 3 Asignaciones de beneficios.

_Las fechas de eventos y reservas se calculan dinámicamente en función del día de ejecución._

---

## ⚡ Primer Acceso

Si no utilizas los datos demo, la pantalla inicial te permitirá realizar un **alta inicial de Administrador** únicamente cuando la API detecte que la base de datos no tiene ningún usuario registrado con rol `ADMIN`. Define una contraseña segura de al menos 12 caracteres para comenzar.

---

## 🛠️ Tecnologías Utilizadas

- **Backend:** Node.js, Express, `mssql` (Driver Tedious), bcryptjs, JWT.
- **Frontend:** HTML5, CSS3, JavaScript Vanilla (sin frameworks ni librerías pesadas).
- **Base de Datos:** Microsoft SQL Server (T-SQL puro, sin ORM).

---

## 🛠️ Preguntas Frecuentes y Solución de Problemas

### ¿Por qué no aparecen Campañas, Beneficios, Restaurantes o Reservas?

Los usuarios con rol `CLIENT` solo tienen acceso a la vista pública/cliente. Módulos administrativos como **Campañas**, **Beneficios**, **Restaurantes** y **Reservas** requieren iniciar sesión con una cuenta de administración o gestión:

- Inicia sesión como `admin@demo.atlantic.local` o `manager@demo.atlantic.local`.
- Si necesitas reponer la información de muestra, ejecuta el script de seed en PowerShell (`$env:SEED_DEMO_DATA="true"; npm run seed:demo`) y verifica que `backend/.env` apunte a la base de datos correcta.

---

## 📋 Consideraciones para Despliegue a Producción

Antes de desplegar en un entorno de producción real, asegúrate de:

1. Configurar un proxy inverso (como Nginx o IIS) con certificados HTTPS (SSL/TLS).
2. Generar un `JWT_SECRET` y credenciales de base de datos seguras e independientes.
3. Establecer políticas de copias de seguridad (Backups) automatizadas en SQL Server.
4. Revisar la documentación complementaria en `docs/MIGRACION.md` y `docs/PRUEBAS.md`.
