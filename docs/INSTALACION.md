# Instalación en Windows

## Requisitos
- Windows 10/11 o Windows Server.
- Node.js LTS (incluye npm).
- Microsoft SQL Server 2019 o superior: Express o Developer.
- SQL Server Management Studio (SSMS).

## 1. Configurar TCP/IP
Abra SQL Server Configuration Manager → SQL Server Network Configuration → Protocols for [instancia] → habilite TCP/IP. En TCP/IP → IP Addresses, configure `TCP Port` estático (por ejemplo 1433) en IPAll y deje `TCP Dynamic Ports` vacío. Reinicie el servicio SQL Server. Abra el puerto TCP en el firewall solo para redes autorizadas.

Si usa instancia con nombre, el método más predecible es configurar puerto TCP estático y usar `DB_SERVER=HOST` junto con `DB_PORT=PUERTO`. También puede usar `DB_SERVER=HOST\\INSTANCIA`; SQL Server Browser debe estar activo y UDP 1434 permitido para resolver puertos dinámicos. No suponga que toda instancia escucha en 1433.

## 2. Crear esquema
Abra SSMS, conecte al motor correcto, abra `backend/database/schema.sql` y ejecútelo. La cuenta que ejecuta este script necesita permiso para crear la base de datos y objetos. No use el usuario de aplicación para instalar el esquema.

## 3. Crear usuario de aplicación con privilegios mínimos
Ejecute como administrador en SSMS, cambiando la contraseña:
```sql
USE master;
CREATE LOGIN crm_app WITH PASSWORD = 'CAMBIAR_POR_UNA_PASSWORD_LARGA_Y_UNICA',
 CHECK_POLICY = ON, CHECK_EXPIRATION = ON;
GO
USE crm_atlantic_city;
CREATE USER crm_app FOR LOGIN crm_app;
GO
-- Permisos de ejecución de DML sobre el esquema dbo; sin db_owner ni sysadmin.
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO crm_app;
GO
```
Para endurecimiento adicional, separe permisos de lectura/escritura por rol y restrinja el acceso de red. No conceda `sa`, `sysadmin` ni `db_owner` a la aplicación.

## 4. Variables de entorno
Copie `backend/.env.example` a `backend/.env` (lo hace `instalar.bat`) y configure:
- `DB_SERVER`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
- `DB_ENCRYPT` y `DB_TRUST_SERVER_CERTIFICATE`.
- `JWT_SECRET` con secreto aleatorio de al menos 32 caracteres.
- `FRONTEND_ORIGIN`.

`DB_PORT` puede omitirse si se usa el puerto predeterminado del cliente, pero se recomienda configurarlo explícitamente. `DB_ENCRYPT=true` en entornos productivos; use un certificado confiable y mantenga `DB_TRUST_SERVER_CERTIFICATE=false`. La opción trust true es solo para desarrollo con certificados autofirmados.

Autenticación integrada de Windows no está activada por esta configuración. No asuma que `mssql` hereda automáticamente la sesión interactiva de Windows. Si se requiere autenticación integrada, debe configurarse expresamente con el mecanismo/driver compatible y la identidad de servicio de Windows.

## 5. Arranque y salud
Ejecute `iniciar.bat`. Verifique `http://localhost:3000/api/health`; solo devuelve `ok:true` si SQL Server responde. Diagnósticos habituales:
- `ESOCKET`: host/puerto inaccesible, TCP/IP o firewall.
- `ECONNREFUSED`: servicio detenido o puerto incorrecto.
- `ELOGIN`: login, contraseña o modo de autenticación incorrectos.

## 6. Datos ficticios para pruebas y demos
Después de ejecutar el esquema y configurar `backend/.env`, desde la raíz del proyecto ejecute en PowerShell:
```powershell
$env:SEED_DEMO_DATA="true"
npm run seed:demo
```
En CMD use `set SEED_DEMO_DATA=true && npm run seed:demo`. El seed crea tres clientes y sus cuentas, más 3 campañas, 3 beneficios, 3 restaurantes, 3 reservas, 3 eventos, 3 inscripciones, 3 ventas, 3 tickets y 3 asignaciones de beneficios. Los registros de catálogo se relacionan entre sí y usan identificadores demo estables para evitar duplicados al repetir la carga. El script no se ejecuta por defecto y se bloquea en `NODE_ENV=production`.

## 7. Operación
Guarde `.env` fuera del control de versiones. Respaldar base de datos, rotar secretos y probar restauración. En producción, publique detrás de HTTPS y no exponga SQL Server directamente a Internet.

## Cuentas de demostración y niveles de acceso

En un entorno local/no productivo, carga las cuentas y datos de muestra con `SEED_DEMO_DATA=true` y `npm run seed:demo`.

| Nivel | Usuario | Contraseña | Acceso |
|---|---|---|---|
| Administrador | `admin@demo.atlantic.local` | `DemoAdmin#2026` | Administración, usuarios, auditoría, integraciones y todos los módulos |
| Gerencia / Operaciones | `manager@demo.atlantic.local` | `DemoManager#2026` | Clientes, atención, reservas, restaurantes, eventos y operaciones permitidas |
| Marketing | `marketing@demo.atlantic.local` | `DemoMarketing#2026` | Clientes, campañas, beneficios, eventos, ventas y reportes permitidos |
| Cliente | `lucia.ramirez@demo.atlantic.local` | `DemoCliente#101` | Solo sus propios datos y tickets |
| Cliente | `mateo.fernandez@demo.atlantic.local` | `DemoCliente#102` | Solo sus propios datos y tickets |
| Cliente | `valentina.torres@demo.atlantic.local` | `DemoCliente#103` | Solo sus propios datos y tickets |

Los roles internos corresponden a los permisos existentes en la API: `ADMIN`, `EMPLOYEE` (gerencia/operaciones) y `MARKETING`. El rol `CLIENT` está limitado a los datos asociados a su propia cuenta. Las contraseñas demo se guardan como hashes bcrypt. No cargues estas cuentas en producción.

## Modo claro y oscuro

El selector de tema está disponible tanto en la pantalla de acceso como dentro del CRM. La preferencia se guarda en el navegador (`localStorage`, clave `ac_theme`) y se conserva al navegar entre módulos y al volver a iniciar sesión en el mismo navegador.
