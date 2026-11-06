# TUQO Lealtad

Plataforma multi-negocio de tarjeta de cliente frecuente. Next.js 15 + TypeScript + Tailwind 4 + Postgres (Neon) con login propio. Interfaz en español.

## Cómo funciona
1. Plataforma (`/plataforma`) crea un negocio (p. ej. `ibloom`) y usuarios de personal.
2. La clienta se registra en `/registro/<slug>` y recibe su tarjeta en `/tarjeta/<token>` (progreso + QR).
3. El personal inicia sesión en `/login`, escanea el QR con la cámara en `/panel` (o escribe el código) y se suma la visita.
4. Al llegar a la meta se genera un beneficio; se canjea en `/panel/clientas`.
5. La administradora ajusta meta, beneficio, servicio elegible, límite diario y colores en `/panel/ajustes`.

## Seguridad
- Todo el acceso a datos es desde el servidor; RLS activo sin políticas en todas las tablas. La capa de datos está en `lib/db.ts` y `lib/ops.ts`.
- Contraseñas con scrypt; sesiones con token aleatorio guardado como hash SHA-256, cookie `httpOnly`, 8 horas; máximo 5 intentos de login por correo cada 15 minutos.
- El negocio de cada operación sale de la membresía del usuario autenticado, nunca de datos enviados por el cliente.
- Visitas, canjes y anulaciones son transacciones atómicas con bloqueo de fila; límite de visitas por día por clienta en la zona horaria del negocio.
- El QR es un código opaco distinto del enlace secreto de la tarjeta. Las visitas se anulan (no se borran).

## Puesta en marcha
1. Crea un proyecto en [Neon](https://neon.tech) y copia la cadena de conexión *pooled* (`DATABASE_URL`).
2. `cp .env.example .env.local` y completa `DATABASE_URL`, `BOOTSTRAP_EMAIL` y `BOOTSTRAP_PASSWORD`.
3. `npm install && npm run dev`.

El esquema se crea solo en el primer arranque, junto con I Bloom de ejemplo (`/registro/ibloom`) y el usuario de plataforma. Entra en `/login` y crea el personal en `/plataforma`. La cámara requiere HTTPS o localhost.

## Vercel
Define `DATABASE_URL`, `BOOTSTRAP_EMAIL` y `BOOTSTRAP_PASSWORD` en Settings → Environment Variables y redespliega. Tras el primer arranque puedes quitar `BOOTSTRAP_PASSWORD`.

## Pendiente
- Apple Wallet / Google Wallet (fase 2), recuperación de contraseña, límites por IP en el borde, logo por negocio.
