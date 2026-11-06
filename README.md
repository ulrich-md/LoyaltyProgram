# Sello · demo comercial de lealtad

Next.js 16, React 19, TypeScript, Tailwind 4 y PostgreSQL/Supabase. Interfaz en español, Bruma Café ficticio, ocho sellos y una recompensa sin valor comercial. No integra pagos, POS ni campañas.

**Estado:** el flujo web está implementado y validado localmente. Apple Wallet / Google Wallet reales NO están integrados: la documentación de Pass Studio devuelve un bloqueo de red 403. El adaptador falla de forma explícita hasta implementar su transporte contra documentación verificada. Tener una API key o plantilla por sí solo no activa Wallet. No se consumieron créditos. Consulta [estado y pruebas](docs/VERIFICACION.md).

## Ejecutar la demo local

Requisitos: Node 24, npm y Docker. Usa el checkout existente; cada tarea cloud ya está aislada, no necesita otro worktree.

```bash
npm ci
npm run db:local
node scripts/setup-local.mjs
npm run dev
```

Abre el puerto 3000 mediante tu entorno de desarrollo. Registro: `/registro/bruma`. Caja, administración y plataforma: `/login`.

Cuentas exclusivamente locales:

| Correo | Rol |
| --- | --- |
| plataforma@demo.local | Plataforma |
| admin@demo.local | Administrador de Bruma |
| caja@demo.local | Cajero de Bruma |

Contraseña local: `demostracion-local-2026`. No es una credencial de un servicio externo. La sesión es aleatoria, se almacena con hash y vence en ocho horas. `LOCAL_DEMO` solo funciona en desarrollo, nunca con `next start`. No uses datos personales reales. El script no sobrescribe un `.env.local` existente.

Docker conserva datos en `loyalty-data`, puerto de PostgreSQL enlazado **solo a 127.0.0.1:54322**. `npm run db:local` se puede repetir y vuelve a arrancar el contenedor. No borres el volumen si necesitas conservar registros.

## Supabase y despliegue

1. Crea o utiliza un proyecto Supabase propio. No se crean cuentas ni se contratan servicios automáticamente.
2. Aplica, en orden y en transacciones, `supabase/migrations/001_loyalty.sql` y `002_operations.sql` mediante el SQL editor o tu gestor de migraciones. No ejecutes de nuevo una migración ya aplicada. El seed está pensado para la demo local; no contiene usuarios de Supabase Auth.
3. Configura las variables de `.env.example` en el servidor. `LOCAL_DEMO=false`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `APP_URL=https://tu-dominio` son necesarios. Las claves no llevan prefijo `NEXT_PUBLIC_` y no se envían al navegador. No hace falta `DATABASE_URL` para las peticiones web en Supabase. La cola futura sí necesitará un worker con conexión PostgreSQL segura y TLS verificado.
4. Crea el primer usuario de plataforma en Supabase Auth y registra su UUID real:

```sql
insert into public.memberships(user_id,business_id,role,email)
values ('UUID-REAL-DE-AUTH',null,'platform','tu-correo@tu-dominio');
```

5. Configura Site URL y Redirect URLs de Auth al dominio HTTPS y `/auth/callback`. Activa correo y un SMTP adecuado. La recuperación usa enlace de un solo uso y PKCE; se debe abrir en el mismo navegador. Para invitaciones configura el enlace de la plantilla de correo como `https://tu-dominio/auth/callback?token_hash={{ .TokenHash }}&type=invite`. Las invitaciones usan `verifyOtp`; no se confía en el correo para autorizar acceso. El invitado puede usar «Recuperar acceso» para entrar con enlace y luego «Volver al panel». Las invitaciones de usuarios ya existentes requieren asignar la membresía por un operador de plataforma mediante SQL; no se reasigna un usuario por correo sin verificarlo.
6. Ejecuta `npm run build`, después `npm start` en un host Node compatible, o despliega Next.js en tu proveedor. Configura `APP_URL` exactamente con el origen utilizado: las mutaciones rechazan orígenes distintos. Usa HTTPS para cámara, sesiones seguras y pruebas desde teléfonos. No publiques la demo con el acceso local compartido.
7. Verifica inicio de sesión, invitación y recuperación reales: esos correos y un proyecto Supabase remoto no se han probado en este entorno.

Configura además la protección de tráfico del hosting para registro público y Auth. Hay límites persistentes por correo en login, registro y recuperación, además de los límites de Supabase; no sustituyen protección por IP en el borde. Los enlaces de tarjeta son secretos de acceso de alta entropía: no los publiques. El QR de caja contiene otro UUID opaco y requiere empleado autenticado para modificar saldos.

## Modelo y garantías

- Una fila de negocio representa su único programa. Membresías con `platform`, `admin`, `cashier`. RLS para lecturas; escrituras exclusivamente mediante funciones autorizadas. No se permite insertar directamente movimientos desde el cliente.
- Cada operación bloquea al cliente en una transacción. Una clave idempotente por negocio identifica el intento lógico. Los reintentos de la misma operación devuelven el resultado original. Una recompensa se canjea solo desde `available`.
- La meta, recompensa y condiciones se congelan al comenzar cada ciclo; también en cada recompensa. Las metas nuevas se toman al iniciar el ciclo siguiente. Se puede seguir acumulando con premios pendientes.
- Las correcciones son movimientos de reversión, con motivo y administrador. Se revierte primero la última operación efectiva para preservar dependencias entre ciclos y premios. El historial no se borra en operación normal.
- Correo normalizado único por negocio. Registrar un correo existente no revela su tarjeta; recuperar requiere verificación mediante Supabase Auth.
- Solicitar Wallet es explícito. La lectura, el QR, el escaneo y el seed no emiten pases. Las operaciones confirmadas agregan trabajos persistentes en la misma transacción que el movimiento. La tarjeta web no depende de la sincronización.
- `wallet_cards` conserva proveedor original, IDs externos, enlace, versión y errores. `lib/worker.ts` serializa trabajos y presupuestos con bloqueo asesor, descarta versiones obsoletas y usa el estado vigente. Fallos de créditos o respuesta incierta requieren intervención; errores temporales se acotan a cuatro intentos.
- `wallet_operations.estimated_units` cuenta una unidad local por operación, **no créditos oficiales**. Los topes de `WALLET_ISSUE_LIMIT` y `WALLET_UPDATE_LIMIT` son acumulados para toda la demo. No hay un presupuesto separado que se reinicie por usuario ni mes.
- `lib/wallet.ts` define los contratos web, Pass Studio y futuros proveedores. El transporte HTTP de Pass Studio sigue pendiente de documentación. El worker de ejemplo se niega a arrancar por defecto. No actives `PASS_STUDIO_TRANSPORT_VERIFIED` hasta completar y probar el transporte; la bandera por sí sola no implementa ninguna API.

## Validar

```bash
npm run typecheck
npm test
npm run test:db  # PostgreSQL local, crea y limpia únicamente sus negocios de prueba
# Con npm run dev activo y sin datos personales reales:
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:browser
```

Si tu máquina no trae Chromium, instala el navegador de Playwright con `npx playwright install chromium` y omite `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. `TEST_DATABASE_URL` permite usar una base de pruebas separada. Las pruebas de DB requieren un propietario de una base **de pruebas**, pues verifican permisos mediante un rol sin privilegios. Nunca apuntes esa suite a producción.

El test del navegador registra un cliente ficticio único y deja su historial para inspección; no borra datos externos. Cámara denegada se prueba en Chromium. La lectura de una cámara física y Wallet en iPhone/Android se verifican manualmente: [guía móvil](docs/PRUEBA-MOVIL.md).

## Datos de ejemplo

El seed incluye Mariana (7 sellos), Diego (un premio y 2 sellos) y Ana (2 sellos). No crea pases. «Mi programa → Reiniciar clientes de ejemplo» requiere escribir REINICIAR y ser administrador. Solo funciona en modo local; sustituye esas tres fichas y conserva otros clientes. Si alguna tiene una tarjeta externa registrada, se bloquea todo el reinicio sin eliminar ni revocar nada fuera de la aplicación.

## Wallet y transición futura

[Configuración y bloqueo de Pass Studio](docs/PASS-STUDIO.md). Cambiar el proveedor predeterminado no cambia las tarjetas emitidas: el worker enruta por el proveedor guardado en la tarjeta, no por el negocio. Una futura reemisión creará otra tarjeta externa bajo petición explícita del titular y mantendrá el cliente, saldo e historial. El titular deberá agregarla de nuevo; no existe transferencia automática de certificados, emisores o instalaciones. Apple y Google directos son contratos no disponibles, sin adaptadores ficticios.
