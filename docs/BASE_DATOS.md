# Base de datos SQL Server

El esquema es `backend/database/schema.sql`, escrito en T-SQL para SQL Server 2019+. Usa `IDENTITY` solo si corresponde (los identificadores CRM actuales son UUID en `CHAR(36)`), `NVARCHAR`, `DATETIME2`, `BIT`, `DECIMAL`, claves foráneas, restricciones `UNIQUE` e índices. Es idempotente para la creación inicial de tablas y añade las columnas de compatibilidad `users.is_active` y `benefits.updated_at` si faltan.

Tablas incluidas: Users, Clients, ClientActivity, Campaigns, Benefits, BenefitAssignments, Tickets, TicketHistory, AuditEvents, Restaurants, Reservations, Events, EventRegistrations, Sales, Integrations, IntegrationEvents y AppSettings.

La aplicación utiliza el pool reutilizable `mssql` y parámetros nombrados (`request.input`) para valores. Las operaciones multi-tabla de alta de cliente, canjes y registros de evento usan transacciones. Nunca concatene valores de usuario en SQL.

La cuenta que ejecuta el DDL debe tener permisos de administración de esquema; la cuenta `crm_app` solo recibe permisos DML mínimos en la base del CRM. Véase `INSTALACION.md` para login y usuario dedicados.

Los datos de negocio reales no se incluyen en el esquema. Para demos existe `backend/scripts/seed-demo.js`, que crea tres clientes ficticios y sus usuarios con hashes bcrypt. Debe habilitarse expresamente con `SEED_DEMO_DATA=true`; se bloquea en `NODE_ENV=production`. Las cuentas y contraseñas se documentan en el README. No cargue estos usuarios en producción.
