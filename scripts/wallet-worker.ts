import postgres from "postgres";
import { processOne } from "../lib/worker";
import { PassStudioWalletProvider, WebWalletProvider } from "../lib/wallet";
// Intentionally unavailable: never turn this into a guessed HTTP implementation.
async function main() {
  if (!process.env.DATABASE_URL) throw Error("Falta DATABASE_URL del servidor");
  if (process.env.PASS_STUDIO_TRANSPORT_VERIFIED !== "true")
    throw Error(
      "Worker externo bloqueado: verifica e implementa el transporte oficial antes de activarlo.",
    );
  const sql = postgres(process.env.DATABASE_URL, { max: 2 });
  const limit = (name: string, fallback: number) => {
    const n = Number(process.env[name] ?? fallback);
    if (!Number.isSafeInteger(n) || n < 0)
      throw Error("Límite inválido: " + name);
    return n;
  };
  try {
    await processOne(
      sql,
      [
        new WebWalletProvider(process.env.APP_URL!),
        new PassStudioWalletProvider(),
      ],
      {
        issue: limit("WALLET_ISSUE_LIMIT", 2),
        update: limit("WALLET_UPDATE_LIMIT", 12),
      },
    );
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
