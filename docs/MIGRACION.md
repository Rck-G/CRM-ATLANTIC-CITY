# Informe de análisis y migración

## Inventario recibido
El archivo `CRM_ATLANTIC_CITY_SQL_SERVER.zip` contiene 30 entradas: estructura de frontend con una pantalla principal y JavaScript/CSS, un backend Express concentrado en `app.js`, adaptador `db.js`, un esquema T-SQL y documentación/archivos BAT. No contiene un repositorio histórico, datos de negocio, migraciones anteriores ni un conjunto de pruebas.

## Hallazgos técnicos
- El adaptador original mezclaba SQL de MySQL (`?`, `NOW()`, `LIMIT`, `DATE_SUB`, `FOR UPDATE`) y traducciones de texto para SQL Server; la traducción no era segura ni fiable para producción.
- El `.env.example` recomendaba `sa` y el nombre de variable TLS no coincidía con el requisito.
- El frontend no cubría todos los módulos solicitados en el alcance detallado.
- El código de servidor mezclaba autenticación, acceso a datos, reglas y rutas en un único archivo.
- El alta inicial necesitaba una comprobación atómica para impedir dos administradores concurrentes.

## Cambios aplicados
- Reemplazo de la capa de acceso por pool `mssql` y consultas con parámetros nombrados `request.input`.
- Configuración explícita `DB_TRUST_SERVER_CERTIFICATE`; sin credenciales predeterminadas `sa`.
- Health check que responde 503 si SQL Server no está disponible, con diagnóstico básico `ESOCKET`, `ECONNREFUSED` y `ELOGIN`.
- Autenticación bcrypt/JWT, limitación de intentos, verificación del usuario activo, alta inicial transaccional y autorización por roles en el backend.
- Operaciones de clientes, campañas, beneficios, tickets, restaurantes, reservas, eventos e integraciones, junto con usuarios, ventas, auditoría, VIP, reportes y operaciones de inscripción/canje.
- Transacciones para operaciones que afectan varias tablas y prevención de doble canje/registro simultáneo por bloqueo transaccional.
- Ajuste de esquema para campos utilizados por la API.

## Límites
No es posible certificar que se conservaron todas las reglas del CRM previo porque el ZIP no incluía ese proyecto original completo. El módulo HelpDesk conserva alta y listado; aún requiere completar la interfaz de asignación, historial y resolución. También faltan la edición/activación de usuarios desde la UI, las vistas completas de analítica, notificaciones y varias acciones operativas. Las integraciones externas no se simulan: se registra su estado y el webhook POS solo funciona con secreto configurado.
