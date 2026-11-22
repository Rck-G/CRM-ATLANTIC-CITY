# Manual de usuario

## Usuarios ficticios para demostración
En un entorno local, el administrador técnico puede cargar las tres cuentas demo descritas en `README.md` mediante el procedimiento de `INSTALACION.md`. Cada una inicia sesión como cliente y solo puede consultar sus propios tickets; no tiene acceso al listado interno de clientes ni a módulos administrativos.

## Primer administrador
En la pantalla de acceso, seleccione “Configurar primer administrador” únicamente si la API indica que no existe ADMIN. Use correo válido y contraseña de al menos 12 caracteres. Una vez creado, la ruta queda cerrada en backend.

## Inicio de sesión
Ingrese correo y contraseña. El token expira según `JWT_EXPIRES_IN` (por defecto 8 horas). Cerrar sesión elimina la sesión del navegador.

## Navegación
El menú presenta los módulos habilitados para el rol. Dashboard consulta indicadores SQL; Clientes permite registrar, consultar y editar; Campañas, Beneficios, Tickets, Restaurantes, Reservas, Eventos, Ventas, Usuarios, Integraciones y Auditoría muestran sus registros según permisos.

## Clientes y VIP
Registre documento y nombres. Documento único y correos únicos de usuarios se validan en SQL Server. El consentimiento de marketing debe reflejar la autorización real del cliente. El recálculo VIP utiliza actividad registrada en `ClientActivity` durante los últimos 365 días; los umbrales actuales del código son Silver <250, Gold desde 250 y Platinum desde 1000. Confirme estos umbrales con el negocio antes de producción.

## Reservas y eventos
Las reservas requieren restaurante, nombre, cantidad de personas e intervalo. La API valida el intervalo y comprueba solapamientos por restaurante dentro de una transacción serializable. Eventos publicados admiten inscripciones y control de aforo transaccional.

## Integraciones y ventas
No se ejecuta ninguna integración externa por defecto. El endpoint POS requiere `INTEGRATION_WEBHOOK_SECRET` y cabecera `x-integration-secret`. No comparta esa clave.

## Temas
El botón de tema alterna claro/oscuro; la preferencia se guarda en el navegador.
