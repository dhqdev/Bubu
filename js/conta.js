/**
 * Conta na nuvem: fala com o servidor do Bubu (quando ele existe).
 * Sem servidor (ex.: GitHub Pages ou offline), o jogo continua funcionando só no aparelho.
 */
const KEY_TOKEN = "bubu:token";
const KEY_CONTA = "bubu:conta";
const KEY_VERSAO = "bubu:versao-nuvem";

function get(k) { try { return localStorage.getItem(k); } catch { return null; } }
function set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem armazenamento */ } }

export function token() { return get(KEY_TOKEN); }
export function conta() { try { return JSON.parse(get(KEY_CONTA) || "null"); } catch { return null; } }
export function versao() { return Number(get(KEY_VERSAO) || 0); }
export function setVersao(v) { set(KEY_VERSAO, String(v)); }

async function call(path, { method = "GET", body, keepalive = false } = {}) {
  const t = token();
  const r = await fetch(path, {
    method,
    keepalive,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, ok: r.ok, data };
}

/** Existe servidor? (timeout curto para não travar quem está offline) */
export async function servidorDisponivel() {
  if (location.protocol === "file:") return false;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch("api/saude", { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(to);
    if (!r.ok) return false;
    const d = await r.json();
    return d.ok === true;
  } catch {
    return false;
  }
}

function guardar(d) {
  set(KEY_TOKEN, d.token);
  set(KEY_CONTA, JSON.stringify(d.conta));
  set(KEY_VERSAO, "0");
}

export async function cadastrar(usuario, senha, nome) {
  const r = await call("api/cadastro", { method: "POST", body: { usuario, senha, nome } });
  if (!r.ok) throw new Error(r.data?.erro || "Não consegui criar a conta.");
  guardar(r.data);
  return r.data.conta;
}

export async function entrar(usuario, senha) {
  const r = await call("api/entrar", { method: "POST", body: { usuario, senha } });
  if (!r.ok) throw new Error(r.data?.erro || "Não consegui entrar.");
  guardar(r.data);
  return r.data.conta;
}

export async function sair() {
  try { await call("api/sair", { method: "POST" }); } catch { /* offline */ }
  set(KEY_TOKEN, null); set(KEY_CONTA, null); set(KEY_VERSAO, null);
}

/** Confere se o login ainda vale. null = sessão inválida; "offline" = sem rede (mantém o login). */
export async function eu() {
  if (!token()) return null;
  try {
    const r = await call("api/eu");
    if (r.status === 401) { set(KEY_TOKEN, null); return null; }
    return r.ok ? r.data.conta : "offline";
  } catch {
    return "offline";
  }
}

export async function baixarSave() {
  const r = await call("api/save");
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(r.data?.erro || "Erro ao baixar o save");
  setVersao(r.data.versao);
  return r.data;
}

/**
 * Envia o save. Devolve { ok } ou { conflito, servidor } quando outro aparelho salvou depois.
 */
export async function enviarSave(dados, { forcar = false, keepalive = false } = {}) {
  const r = await call("api/save", { method: "PUT", body: { dados, versao: versao(), forcar }, keepalive });
  if (r.ok) { setVersao(r.data.versao); return { ok: true }; }
  if (r.status === 409) return { conflito: true, servidor: r.data };
  if (r.status === 401) return { sessao: false };
  return { erro: r.data?.erro || "erro" };
}
