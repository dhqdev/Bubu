/** Inicia o servidor do Bubu: node server/index.mjs (precisa de DATABASE_URL). */
import { readFileSync } from "node:fs";
import { createPool, waitFor, migrate } from "./db.mjs";
import { createServer, VERSION } from "./app.mjs";

// No Swarm a senha do banco pode vir de um arquivo (DATABASE_URL_FILE ou POSTGRES_PASSWORD_FILE)
if (!process.env.DATABASE_URL && process.env.DATABASE_URL_FILE) {
  process.env.DATABASE_URL = readFileSync(process.env.DATABASE_URL_FILE, "utf8").trim();
}

const PORT = Number(process.env.PORT || 3000);
const pool = createPool();
await waitFor(pool);
await migrate(pool);

const server = createServer(pool);
server.listen(PORT, "0.0.0.0", () => console.log(`Bubu ${VERSION} ouvindo na porta ${PORT}`));

const stop = async () => {
  console.log("desligando...");
  server.close();
  await pool.end().catch(() => {});
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
