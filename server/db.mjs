/**
 * Banco do Bubu (Postgres): contas, sessões e o save de cada jogador.
 * As tabelas são criadas sozinhas na primeira vez (migrações simples e idempotentes).
 */

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS contas (
     id          BIGSERIAL PRIMARY KEY,
     usuario     TEXT NOT NULL UNIQUE,
     nome        TEXT NOT NULL,
     senha_hash  TEXT NOT NULL,
     criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
     ultimo_login TIMESTAMPTZ
   )`,
  `CREATE TABLE IF NOT EXISTS sessoes (
     token_hash  TEXT PRIMARY KEY,
     conta_id    BIGINT NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
     criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
     expira_em   TIMESTAMPTZ NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS sessoes_conta ON sessoes(conta_id)`,
  `CREATE TABLE IF NOT EXISTS saves (
     conta_id    BIGINT PRIMARY KEY REFERENCES contas(id) ON DELETE CASCADE,
     dados       JSONB NOT NULL,
     versao      INTEGER NOT NULL DEFAULT 1,
     atualizado  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
];

// o driver só é carregado quando tem banco (assim os testes sem banco não precisam do npm ci)
export async function createPool(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL não definida");
  const { default: pg } = await import("pg");
  return new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30000 });
}

/** Espera o Postgres subir (no Swarm o app pode iniciar antes do banco). */
export async function waitFor(pool, tries = 30) {
  for (let i = 1; i <= tries; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (e) {
      if (i === tries) throw e;
      console.log(`aguardando o Postgres (${i}/${tries})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export async function migrate(pool) {
  for (const sql of MIGRATIONS) await pool.query(sql);
}

export const q = {
  async createAccount(pool, { usuario, nome, senhaHash }) {
    const r = await pool.query(
      "INSERT INTO contas (usuario, nome, senha_hash) VALUES ($1, $2, $3) ON CONFLICT (usuario) DO NOTHING RETURNING id, usuario, nome",
      [usuario, nome, senhaHash]
    );
    return r.rows[0] || null;
  },
  async accountByUser(pool, usuario) {
    const r = await pool.query("SELECT id, usuario, nome, senha_hash FROM contas WHERE usuario = $1", [usuario]);
    return r.rows[0] || null;
  },
  async touchLogin(pool, id) {
    await pool.query("UPDATE contas SET ultimo_login = now() WHERE id = $1", [id]);
  },
  async createSession(pool, tokenHash, contaId, days) {
    await pool.query("INSERT INTO sessoes (token_hash, conta_id, expira_em) VALUES ($1, $2, now() + make_interval(days => $3))", [tokenHash, contaId, days]);
    await pool.query("DELETE FROM sessoes WHERE expira_em < now()");
  },
  async sessionAccount(pool, tokenHash) {
    const r = await pool.query(
      "SELECT c.id, c.usuario, c.nome FROM sessoes s JOIN contas c ON c.id = s.conta_id WHERE s.token_hash = $1 AND s.expira_em > now()",
      [tokenHash]
    );
    return r.rows[0] || null;
  },
  async deleteSession(pool, tokenHash) {
    await pool.query("DELETE FROM sessoes WHERE token_hash = $1", [tokenHash]);
  },
  async getSave(pool, contaId) {
    const r = await pool.query("SELECT dados, versao, atualizado FROM saves WHERE conta_id = $1", [contaId]);
    return r.rows[0] || null;
  },
  /** Grava se a versão do cliente for a atual (ou se ainda não existe). Devolve a nova versão ou null em conflito. */
  async putSave(pool, contaId, dados, baseVersion, force = false) {
    const r = await pool.query(
      `INSERT INTO saves (conta_id, dados, versao) VALUES ($1, $2, 1)
       ON CONFLICT (conta_id) DO UPDATE SET dados = EXCLUDED.dados, versao = saves.versao + 1, atualizado = now()
       WHERE $4 OR saves.versao = $3
       RETURNING versao`,
      [contaId, dados, baseVersion ?? 0, force]
    );
    return r.rows[0]?.versao ?? null;
  },
  async deleteAccount(pool, contaId) {
    await pool.query("DELETE FROM contas WHERE id = $1", [contaId]);
  },
};
