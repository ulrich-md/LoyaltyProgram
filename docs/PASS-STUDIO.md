# Pass Studio: bloqueo explícito y activación pendiente

Se intentó consultar el 6 de noviembre de 2026:

- https://www.thepassstudio.com/docs/integrations
- https://www.thepassstudio.com/docs/billing
- https://www.thepassstudio.com/docs/certificates

La política del proxy devolvió `403 CONNECT / Domain forbidden`. Los dominios se agregaron al borrador de configuración cloud, pero guardar el borrador no aplica la política a la máquina. Se debe revisar y guardar esa configuración para permitir la consulta. No se han verificado endpoints, autenticación, campos, idempotencia, límites, precios, certificados incluidos ni posibilidades de las plantillas.

Por tanto, **no hay transporte HTTP implementado**, no se presenta una integración simulada como real y no basta pegar una API key. La tarjeta web, los movimientos y las pruebas con mocks sí funcionan. El panel distingue «pendiente de integración», no «conectado».

## Trabajo necesario al desbloquear documentación

1. Leer las tres páginas oficiales. Registrar endpoints exactos, cabeceras de autenticación, campos de plantilla, respuesta de emisión (IDs y URL), actualización, consulta y revocación, si existen. Verificar si la API ofrece idempotencia externa y cómo reconciliar una respuesta incierta antes de permitir reemisiones.
2. Confirmar desde la documentación/panel del proveedor cómo crear una plantilla compatible con sellos. Documentar entonces los pasos **exactos** del panel, asignación del QR opaco y campos de progreso/recompensa. No se inventan aquí nombres de botones ni parámetros no consultados. Verificar que los certificados del proveedor realmente cubren Apple y Google para esa plantilla/cuenta.
3. Guardar la API key solo en el servidor mediante un secreto seguro. Configurar `PASS_STUDIO_API_KEY`; nunca en `NEXT_PUBLIC_*`, archivos versionados ni parámetros de URL. No se crea cuenta, contrata servicio o compra saldo desde esta app.
4. Implementar `PassStudioTransport` en un módulo exclusivo del servidor e inyectarlo en `PassStudioWalletProvider`. Mapear todos los IDs y errores sin mantener un segundo saldo. La plantilla solo representa el estado de nuestra base. Verificar que una petición lógica corresponde a una única operación externa y que un timeout no provoca emisión doble. Añadir pruebas de contrato contra fixtures oficiales; las suites no llaman al proveedor real.
5. Conectar el transporte tanto a la solicitud explícita de emisión como al worker persistente. Actualmente `/api/wallet` y `/api/retry-wallet` fallan de forma explícita para pases externos; reemplazar esa barrera solo después de verificar el transporte. Los RPC de solicitud y la cola ya existen.
6. Plataforma → Wallet: elegir Pass Studio y guardar el identificador de plantilla por negocio. Introducir topes de emisión y actualización en variables de servidor; conservarlos globales y persistentes.
7. Programar el worker con conexión PostgreSQL segura. `processOne` usa bloqueo para serializar. La reserva de uso y la llamada externa no son una transacción distribuida: exige idempotencia del proveedor o conciliación verificable para manejar un fallo de proceso después de emitir y antes de guardar. Sin esa garantía, no activar la emisión real.
8. Implementar reintento administrativo de trabajos bloqueados, diferenciando presupuesto agotado (después de ampliar presupuesto), falta de créditos (después de reponerlos), configuración y estado externo incierto (conciliación manual). No desbloquear indiscriminadamente todos los trabajos ni reemitir instancias inciertas.
9. Verificar manualmente una emisión de bajo consumo antes de anunciar la integración. Registrar respuesta real, créditos facturados y comportamiento en ambos dispositivos. `status()` devuelve instalación desconocida hasta tener evidencia oficial de una API que la observe.

## Presupuesto

Los topes predeterminados permiten 2 emisiones y 12 actualizaciones. El contador de uso es una estimación de **operaciones**, no saldo de Pass Studio. La tarifa por emisión, actualización, plantilla y certificado queda pendiente de verificar en billing. No se inventa una equivalencia de una llamada = un crédito.

La prueba corta propuesta usa 2 emisiones + 4 actualizaciones; su costo será `2 × tarifa_emisión + 4 × tarifa_actualización`, más cualquier cargo fijo que billing confirme. Detener la prueba si el precio real excede el saldo autorizado.
