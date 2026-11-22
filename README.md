# CRM Atlantic City — migración SQL Server

Proyecto web con HTML/CSS/JavaScript puro y API Node.js/Express conectada a Microsoft SQL Server mediante `mssql`.

## Inicio rápido (Windows)
1. Instale Node.js LTS y SQL Server 2019+ (Express o Developer) y SSMS.
2. Ejecute `instalar.bat`.
3. En SSMS, abra y ejecute `backend/database/schema.sql` con una cuenta administrativa de SQL Server. El script crea `crm_atlantic_city`.
4. Cree el login/usuario de aplicación según `docs/BASE_DATOS.md`.
5. Edite `backend/.env` a partir de `backend/.env.example`.
6. Para cargar cuentas ficticias de demostración, abra una terminal en la carpeta del proyecto y ejecute En PowerShell: `$env:SEED_DEMO_DATA="true"; npm run seed:demo` (solo desarrollo). En CMD: `set SEED_DEMO_DATA=true && npm run seed:demo`.
7. Ejecute `iniciar.bat` y abra http://localhost:3000.

La API no declara salud correcta si SQL Server no responde: `GET /api/health` devuelve HTTP 503 y diagnóstico de conexión.

## Cuentas ficticias de demostración
La carga es explícita y está bloqueada cuando `NODE_ENV=production`. No se ejecuta automáticamente. Tras configurar SQL Server, use `$env:SEED_DEMO_DATA="true"; npm run seed:demo` en PowerShell o `set SEED_DEMO_DATA=true && npm run seed:demo` en CMD.

| Cliente de prueba | Usuario (correo) | Contraseña |
|---|---|---|
| Lucía Ramírez | `lucia.ramirez@demo.atlantic.local` | `DemoCliente#101` |
| Mateo Fernández | `mateo.fernandez@demo.atlantic.local` | `DemoCliente#102` |
| Valentina Torres | `valentina.torres@demo.atlantic.local` | `DemoCliente#103` |

Son cuentas con rol `CLIENT`, datos inventados y contraseñas almacenadas con bcrypt. El script es idempotente y no cambia contraseñas de cuentas ya existentes. No reutilice estas credenciales en producción.


### Datos incluidos en la demo
El instalador crea, de forma idempotente, 3 campañas, 3 beneficios vinculados a campañas, 3 restaurantes, 3 reservas asociadas a clientes y restaurantes, 3 eventos publicados, 3 inscripciones, 3 ventas, 3 tickets y 3 asignaciones de beneficios. Las reservas y eventos se programan en fechas futuras relativas al momento de ejecutar el seed. Los registros existentes con los mismos códigos demo no se duplican.

### Cuentas internas demo
| Nivel | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin@demo.atlantic.local` | `DemoAdmin#2026` |
| Gerencia / Operaciones | `manager@demo.atlantic.local` | `DemoManager#2026` |
| Marketing | `marketing@demo.atlantic.local` | `DemoMarketing#2026` |

## Primer acceso
La pantalla de acceso muestra el alta inicial solo cuando la API confirma que no existe ningún ADMIN. Si no cargó los datos demo, cree una contraseña de al menos 12 caracteres y luego inicie sesión.

## Tecnologías
Node.js, Express, `mssql` (Tedious), SQL Server, HTML5, CSS3 y JavaScript Vanilla. No usa MySQL, SQLite, ORM ni framework frontend.

## Alcance y estado de migración
El ZIP recibido contenía una base de proyecto (30 entradas) con interfaz y módulos parciales, no una exportación íntegra de un CRM anterior ni sus datos. Se conservaron las pantallas y entidades presentes y se corrigió la capa SQL Server/API. No se puede afirmar equivalencia con funcionalidades o reglas de negocio que no estaban en el archivo entregado. Consulte `docs/MIGRACION.md` y `docs/PRUEBAS.md`.

**Importante:** antes de producción, configure HTTPS detrás de un proxy, secretos propios, política de copias de seguridad, monitorización, revisión de permisos y pruebas de aceptación con los responsables del negocio.


## Si no aparecen Campañas, Beneficios, Restaurantes o Reservas

Estas secciones son módulos internos y no se muestran al iniciar sesión con una cuenta `CLIENT`. Cierre sesión e ingrese como `admin@demo.atlantic.local` (contraseña `DemoAdmin#2026`) o con `manager@demo.atlantic.local` / `DemoManager#2026`. Para volver a cargar los registros de demostración en la base configurada: PowerShell `$env:SEED_DEMO_DATA="true"; npm run seed:demo`. Confirme que el proceso termine con `Carga demo completada`. La aplicación y el script deben apuntar al mismo servidor y base indicados en `backend/.env`.
