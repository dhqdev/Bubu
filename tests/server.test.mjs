// Testes da API. Só rodam com um Postgres disponível: TEST_DATABASE_URL=postgres://... npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createPool, migrate } from "../server/db.mjs";
import { createServer, hashPassword, checkPassword } from "../server/app.mjs";

const URL_DB = process.env.TEST_DATABASE_URL;
let pool, server, base;

test("senha com scrypt", async () => {
  const h = await hashPassword("segredo123");
  assert.ok(await checkPassword("segredo123", h));
  assert.ok(!(await checkPassword("outra", h)));
});

if (URL_DB) {
  before(async () => {
    pool = createPool(URL_DB);
    await pool.query("DROP TABLE IF EXISTS saves, sessoes, contas");
    await migrate(pool);
    server = createServer(pool);
    await new Promise((r) => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(async () => {
    server.close();
    await pool.end();
  });

  const call = (path, { method = "GET", body, token } = {}) =>
    fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

  test("cadastro, login, save e conflito", async () => {
    assert.equal((await call("/api/saude")).status, 200);
    const bad = await call("/api/cadastro", { method: "POST", body: { usuario: "A", senha: "1", nome: "" } });
    assert.equal(bad.status, 400);
    const c = await call("/api/cadastro", { method: "POST", body: { usuario: "David", senha: "senha123", nome: "David" } });
    assert.equal(c.status, 201);
    assert.equal(c.body.conta.usuario, "david");
    assert.equal((await call("/api/cadastro", { method: "POST", body: { usuario: "david", senha: "senha123", nome: "D" } })).status, 409);
    assert.equal((await call("/api/entrar", { method: "POST", body: { usuario: "david", senha: "errada" } })).status, 401);
    const l = await call("/api/entrar", { method: "POST", body: { usuario: "DAVID", senha: "senha123" } });
    assert.equal(l.status, 200);
    const t = l.body.token;
    assert.equal((await call("/api/save", { token: t })).status, 404);
    assert.equal((await call("/api/save")).status, 401);
    const dados = { bubu: { nome: "Bubu" }, needs: { fome: 50 } };
    const p1 = await call("/api/save", { method: "PUT", token: t, body: { dados, versao: 0 } });
    assert.deepEqual(p1, { status: 200, body: { versao: 1 } });
    const p2 = await call("/api/save", { method: "PUT", token: t, body: { dados: { ...dados, x: 1 }, versao: 1 } });
    assert.equal(p2.body.versao, 2);
    const stale = await call("/api/save", { method: "PUT", token: t, body: { dados, versao: 1 } });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.dados.x, 1);
    const forced = await call("/api/save", { method: "PUT", token: t, body: { dados, versao: 1, forcar: true } });
    assert.equal(forced.body.versao, 3);
    const g = await call("/api/save", { token: t });
    assert.equal(g.body.versao, 3);
    assert.equal((await call("/api/sair", { method: "POST", token: t })).status, 200);
    assert.equal((await call("/api/eu", { token: t })).status, 401);
  });

  test("serve o app e bloqueia arquivos de fora", async () => {
    const r = await fetch(base + "/");
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-security-policy"), /default-src 'self'/);
    assert.equal((await fetch(base + "/js/brain.js")).status, 200);
    assert.equal((await fetch(base + "/server/app.mjs")).status, 404);
    assert.equal((await fetch(base + "/package.json")).status, 404);
    assert.equal((await fetch(base + "/js/../server/db.mjs")).status, 404);
  });
}
