/**
 * Servidor do Bubu: entrega o app (PWA) e a API de contas/saves.
 *
 *   GET  /api/saude              status (usado pelo healthcheck do Docker)
 *   POST /api/cadastro           { usuario, senha, nome } → { token, conta }
 *   POST /api/entrar             { usuario, senha }       → { token, conta }
 *   POST /api/sair
 *   GET  /api/eu                 → { conta }
 *   GET  /api/save               → { dados, versao, atualizado } (404 se ainda não tem)
 *   PUT  /api/save               { dados, versao, forcar? } → { versao } (409 em conflito, com o save do servidor)
 *   DELETE /api/conta            { senha } apaga a conta e o save
 *
 * Sem frameworks: só node:http e o driver pg.
 */
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { q } from "./db.mjs";

const scrypt = promisify(_scrypt);
const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), ".."));
const PUBLIC = ["index.html", "manifest.webmanifest", "sw.js", "css/", "js/", "icons/"];
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png",
};
const MAX_BODY = 1024 * 1024; // 1 MB: um save grande tem ~100 KB
const SESSION_DAYS = 90;
export const VERSION = process.env.BUBU_VERSAO || "dev";

// ---------- senhas ----------
export async function hashPassword(senha) {
  const salt = randomBytes(16);
  const key = await scrypt(senha, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
export async function checkPassword(senha, stored) {
  const [alg, s, k] = String(stored).split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const key = await scrypt(senha, Buffer.from(s, "base64"), 64, { N: 16384, r: 8, p: 1 });
  const ref = Buffer.from(k, "base64");
  return ref.length === key.length && timingSafeEqual(ref, key);
}
const sha = (t) => createHash("sha256").update(t).digest("hex");

// ---------- limite de tentativas (por IP) ----------
const attempts = new Map();
function limited(ip, max = 20, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const a = attempts.get(ip) || { n: 0, since: now };
  if (now - a.since > windowMs) { a.n = 0; a.since = now; }
  a.n++;
  attempts.set(ip, a);
  if (attempts.size > 5000) attempts.clear();
  return a.n > max;
}

// ---------- utilidades HTTP ----------
function send(res, status, body, headers = {}) {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": typeof body === "object" && !Buffer.isBuffer(body) ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    ...headers,
  });
  res.end(data);
}
async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error("muito grande"), { status: 413 });
    chunks.push(c);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("JSON inválido"), { status: 400 });
  }
}
function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
}
function tokenOf(req) {
  const h = String(req.headers.authorization || "");
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

const USER_RE = /^[a-z0-9._-]{3,24}$/;
export function cleanUser(u) {
  return String(u || "").trim().toLowerCase();
}

// ---------- API ----------
async function api(req, res, pool, path) {
  const method = req.method;
  if (path === "/api/saude") {
    let banco = "ok";
    try { await pool.query("SELECT 1"); } catch { banco = "fora"; }
    return send(res, banco === "ok" ? 200 : 503, { ok: banco === "ok", banco, versao: VERSION });
  }

  if (path === "/api/cadastro" && method === "POST") {
    if (limited(clientIp(req), 10)) return send(res, 429, { erro: "Muitas tentativas. Espere alguns minutos." });
    const b = await readJson(req);
    const usuario = cleanUser(b.usuario);
    const nome = String(b.nome || "").trim().slice(0, 40);
    const senha = String(b.senha || "");
    if (!USER_RE.test(usuario)) return send(res, 400, { erro: "Usuário: 3 a 24 letras minúsculas, números, ponto, traço ou _." });
    if (senha.length < 6 || senha.length > 200) return send(res, 400, { erro: "A senha precisa ter pelo menos 6 caracteres." });
    if (!nome) return send(res, 400, { erro: "Diga seu nome." });
    const conta = await q.createAccount(pool, { usuario, nome, senhaHash: await hashPassword(senha) });
    if (!conta) return send(res, 409, { erro: "Esse usuário já existe." });
    return send(res, 201, { token: await newSession(pool, conta.id), conta });
  }

  if (path === "/api/entrar" && method === "POST") {
    if (limited(clientIp(req))) return send(res, 429, { erro: "Muitas tentativas. Espere alguns minutos." });
    const b = await readJson(req);
    const c = await q.accountByUser(pool, cleanUser(b.usuario));
    if (!c || !(await checkPassword(String(b.senha || ""), c.senha_hash))) return send(res, 401, { erro: "Usuário ou senha errados." });
    await q.touchLogin(pool, c.id);
    return send(res, 200, { token: await newSession(pool, c.id), conta: { id: c.id, usuario: c.usuario, nome: c.nome } });
  }

  // daqui pra baixo precisa estar logado
  const token = tokenOf(req);
  const conta = token ? await q.sessionAccount(pool, sha(token)) : null;
  if (!conta) return send(res, 401, { erro: "Entre na sua conta." });

  if (path === "/api/eu" && method === "GET") return send(res, 200, { conta });
  if (path === "/api/sair" && method === "POST") {
    await q.deleteSession(pool, sha(token));
    return send(res, 200, { ok: true });
  }
  if (path === "/api/save" && method === "GET") {
    const s = await q.getSave(pool, conta.id);
    return s ? send(res, 200, s) : send(res, 404, { erro: "Ainda não tem save." });
  }
  if (path === "/api/save" && method === "PUT") {
    const b = await readJson(req);
    if (!b.dados || typeof b.dados !== "object" || !b.dados.bubu || !b.dados.needs) return send(res, 400, { erro: "Save inválido." });
    const versao = await q.putSave(pool, conta.id, b.dados, Number(b.versao) || 0, b.forcar === true);
    if (versao == null) return send(res, 409, { erro: "O save mudou em outro aparelho.", ...(await q.getSave(pool, conta.id)) });
    return send(res, 200, { versao });
  }
  if (path === "/api/conta" && method === "DELETE") {
    const b = await readJson(req);
    const c = await q.accountByUser(pool, conta.usuario);
    if (!(await checkPassword(String(b.senha || ""), c.senha_hash))) return send(res, 401, { erro: "Senha errada." });
    await q.deleteAccount(pool, conta.id);
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { erro: "Não encontrado." });
}

async function newSession(pool, contaId) {
  const token = randomBytes(32).toString("base64url");
  await q.createSession(pool, sha(token), contaId, SESSION_DAYS);
  return token;
}

// ---------- arquivos do app ----------
async function serveStatic(req, res, path) {
  if (path === "/" || path === "") path = "/index.html";
  const rel = normalize(path).replace(/^[/\\]+/, "");
  if (!PUBLIC.some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p)) || rel.includes("..")) {
    // rotas desconhecidas caem no app (PWA de uma página só)
    if (!extname(rel)) return serveStatic(req, res, "/index.html");
    return send(res, 404, "Não encontrado");
  }
  const file = join(ROOT, rel);
  try {
    const st = await stat(file);
    if (!st.isFile()) throw new Error("não é arquivo");
    const type = TYPES[extname(file)] || "application/octet-stream";
    const cache = rel === "index.html" || rel === "sw.js" ? "no-cache" : "public, max-age=3600";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
      ...(rel === "index.html" ? { "Content-Security-Policy": CSP } : {}),
    });
    res.end(req.method === "HEAD" ? undefined : await readFile(file));
  } catch {
    send(res, 404, "Não encontrado");
  }
}
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "media-src 'self' blob:",
].join("; ");

export function createServer(pool) {
  return http.createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    try {
      if (path.startsWith("/api/")) return await api(req, res, pool, path);
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Método não permitido");
      return await serveStatic(req, res, path);
    } catch (e) {
      if (e.status) return send(res, e.status, { erro: e.message });
      console.error(e);
      return send(res, 500, { erro: "Erro no servidor." });
    }
  });
}
