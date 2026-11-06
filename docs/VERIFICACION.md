# Evidencia y pendientes

Validación realizada el 6 de noviembre de 2026 en este entorno. No equivale a una publicación ni a validación en otra máquina.

| Comprobación | Resultado |
| --- | --- |
| Instalación con lockfile (`npm ci`) | Correcta |
| Compilación de producción y TypeScript | Correctas |
| Migraciones desde una base PostgreSQL 17 vacía | Correctas |
| Contratos Wallet con mocks | 3 pruebas aprobadas |
| Suite PostgreSQL | 11 casos aprobados (12 resultados incluyendo el contenedor de suite) |
| Navegador Chromium, escritorio y ventana móvil | 2 pruebas aprobadas |
| Registro → tarjeta web → sello → premio → canje | Verificado en navegador |
| Cámara no disponible/denegada y búsqueda manual | Verificadas en Chromium |
| Cámara física y QR en teléfonos | Pendiente |
| Supabase Auth remoto, invitación y recuperación por correo | Implementados; pendientes de credenciales y SMTP para validación real |
| Pass Studio HTTP, plantilla, certificados y facturación | Pendientes: documentación bloqueada por red |
| Pase real Apple Wallet o Google Wallet | No implementado/verificado; no se emitió ningún pase |
| Publicación del entorno/despliegue | No realizada |

Los 11 casos de PostgreSQL cubren: registro por negocio y duplicados sin revelación de enlace; aislamiento y rol cajero; ocho reintentos concurrentes con un sello; una sola recompensa al completar meta y reglas del nuevo ciclo; cinco canjes concurrentes con un único éxito; reversión autorizada sin borrar historial; solicitud idempotente de emisión; límite local que impide llamadas externas; trabajos obsoletos sustituidos por estado más reciente; fallo de créditos sin perder movimientos ni reintento infinito; y RLS con un rol que no es propietario.

Los mocks son transportes en memoria utilizados solo en pruebas. No se muestra un botón de Wallet simulado como si hubiera emitido una tarjeta. `WebWalletProvider` no emite un pase nativo.

Los scripts de DB se ejecutaron de nuevo sobre estado existente. Las migraciones también se aplicaron a una base de verificación vacía. Los datos del navegador son ficticios y quedan visibles para inspección; no hay pases externos vinculados. El reinicio de ejemplos está limitado a los tres clientes del seed local, requiere confirmación y se niega si tienen una tarjeta externa.

## Límites deliberados

- Pass Studio necesita acceso a documentación, transporte HTTP verificado, garantía de idempotencia/conciliación externa y credenciales. Cola, modelo, contratos y pruebas están preparados; todavía no hay un servicio de sincronización externo operativo ni reintento administrativo real.
- Falta comprobar la creación y parametrización exacta de una plantilla del proveedor. No se han inventado pasos del panel ni tarifas de créditos. La guía manual estima operaciones, no un costo oficial.
- Apple/Google directos no disponibles. La reemisión futura requiere que el titular agregue la nueva tarjeta; se conservan los datos locales y proveedor original.
- La demo local usa PostgreSQL y sesiones del servidor para poder demostrar el flujo sin credenciales. El despliegue usa Supabase y deshabilita esa autenticación local.
