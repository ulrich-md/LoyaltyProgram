import { existsSync, writeFileSync } from "node:fs";
const path = new URL("../.env.local", import.meta.url);
if (existsSync(path)) {
  console.log("Se conserva .env.local existente.");
} else {
  writeFileSync(
    path,
    "LOCAL_DEMO=true\nDATABASE_URL=postgres://loyalty:local-demo-only@127.0.0.1:54322/loyalty\nDEMO_LOGIN_PASSWORD=demostracion-local-2026\nAPP_URL=http://localhost:3000\n",
    { mode: 0o600 },
  );
  console.log(
    "Configuración de demostración local creada; no apta para producción.",
  );
}
