# TUQO Lealtad

Plataforma multi-negocio de tarjeta de cliente frecuente. Next.js 15 + TypeScript + Tailwind 4 + SQLite (`node:sqlite`, Node 22+) con login propio. Interfaz en español.

## Cómo funciona
1. Plataforma (`/plataforma`) crea un negocio (p. ej. `ibloom`) y usuarios de personal.
2. La clienta se registra en `/registro/<slug>` y recibe su tarjeta en `/tarjeta/<token>` (progreso + QR).
3. El personal inicia sesión en `/login`, escanea el QR con la cámara en `/panel` (o escribe el código) y se suma la visita.
4. Al llegar a la meta se genera un beneficio; se canjea en `/panel/clientas`.
5. La administradora ajusta meta, beneficio, servicio elegible, límite diario y colores en `/panel/ajustes`.

## Seguridad
- Sin base de datos externa: un archivo SQLite local (`DATA_FILE`). La capa de datos está aislada en `lib/db.ts` y `lib/ops.ts` para migrar luego a Postgres.
- Contraseñas con scrypt; sesiones con token aleatorio guardado como hash SHA-256, cookie `httpOnly`, 8 horas; máximo 5 intentos de login por correo cada 15 minutos.
- El negocio de cada operación sale de la membresía del usuario autenticado, nunca de datos enviados por el cliente.
- Visitas, canjes y anulaciones son transacciones atómicas; límite de visitas por día por clienta en la zona horaria del negocio.
- El QR es un código opaco distinto del enlace secreto de la tarjeta. Las visitas se anulan (no se borran).

## Puesta en marcha
```bash
cp .env.example .env.local   # define BOOTSTRAP_EMAIL y BOOTSTRAP_PASSWORD (usuario de plataforma)
npm install
npm run dev
```
Al primer arranque se crea `data/app.db` con I Bloom de ejemplo (`/registro/ibloom`). Entra en `/login`, crea el personal en `/plataforma`. La cámara requiere HTTPS o localhost; para probar en un teléfono usa un túnel HTTPS.

## Pendiente
- **Despliegue:** SQLite en un archivo no persiste en Vercel; para publicar usa un servidor con disco (VPS, Fly, Railway) o migra a Postgres/Turso.
- Apple Wallet / Google Wallet (fase 2), recuperación de contraseña, límites por IP en el borde, logo por negocio.
