# TUQO Lealtad

Plataforma multi-negocio de tarjeta de cliente frecuente. Next.js 15 + TypeScript + Tailwind 4 + Supabase (Postgres + Auth). Interfaz en español.

## Cómo funciona
1. Plataforma (`/plataforma`) crea un negocio (p. ej. `ibloom`) y usuarios de personal.
2. La clienta se registra en `/registro/<slug>` y recibe su tarjeta en `/tarjeta/<token>` (progreso + QR).
3. El personal inicia sesión en `/login`, escanea el QR con la cámara en `/panel` (o escribe el código) y se suma la visita.
4. Al llegar a la meta se genera un beneficio; se canjea en `/panel/clientas`.
5. La administradora ajusta meta, beneficio, servicio elegible, límite diario y colores en `/panel/ajustes`.

## Seguridad
- Todo acceso a datos es desde el servidor con la service role; RLS está activo sin políticas, por lo que el navegador no lee la base directamente.
- El negocio de cada operación sale de la membresía del usuario autenticado, nunca de datos enviados por el cliente.
- Visitas, canjes y anulaciones son funciones SQL atómicas (bloqueo de fila); límite de visitas por día por clienta en la zona horaria del negocio.
- El QR es un código opaco distinto del enlace secreto de la tarjeta. Las visitas se anulan (no se borran) y quedan con motivo.

## Puesta en marcha
1. Crea un proyecto Supabase; ejecuta `supabase/migrations/001_init.sql` y luego `supabase/seed.sql` (I Bloom de ejemplo).
2. Copia `.env.example` a `.env.local` y completa las claves.
3. Crea tu usuario en Supabase Auth y registra la membresía de plataforma:
```sql
insert into memberships(user_id, business_id, role, email) values ('UUID-AUTH', null, 'platform', 'tu@correo');
```
4. `npm install && npm run dev`. La cámara requiere HTTPS (Vercel) o localhost.

## Pendiente (fase 2)
- Apple Wallet / Google Wallet (el modelo de datos ya separa tarjeta y QR; falta emitir y actualizar pases).
- Límites de tasa por IP en registro/login en el borde, recuperación de contraseña, logo por negocio, pruebas automatizadas de interfaz.
- Pruebas con Supabase real: la lógica SQL se validó en Postgres local; el flujo web con Auth aún no se ha ejecutado de punta a punta.
