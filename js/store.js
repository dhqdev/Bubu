/**
 * Salvamento por jogador, no próprio aparelho (localStorage).
 * Cada jogador tem o seu Bubu: bubu:perfis guarda a lista; bubu:save:<id> guarda o jogo.
 */
import { uid } from "./util.js";

const KEY_PROFILES = "bubu:perfis";
const KEY_LAST = "bubu:ultimo";
const keySave = (id) => `bubu:save:${id}`;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function listProfiles() {
  return read(KEY_PROFILES, []);
}

export function lastProfileId() {
  return read(KEY_LAST, null);
}

export function loadSave(id) {
  return read(keySave(id), null);
}

export function persist(save) {
  const list = listProfiles();
  const entry = { id: save.id, dono: save.dono.nome, bubu: save.bubu.nome, cor: save.bubu.cor, atualizado: Date.now() };
  const i = list.findIndex((p) => p.id === save.id);
  if (i >= 0) list[i] = entry; else list.push(entry);
  write(KEY_PROFILES, list);
  write(KEY_LAST, save.id);
  return write(keySave(save.id), save);
}

export function deleteProfile(id) {
  write(KEY_PROFILES, listProfiles().filter((p) => p.id !== id));
  try { localStorage.removeItem(keySave(id)); } catch { /* sem armazenamento */ }
  if (lastProfileId() === id) write(KEY_LAST, null);
}

/** Cria o save de um novo jogador (o Bubu começa como ovinho). */
export function newSave({ dono, bubu, cor, aniversario }) {
  const seed = Math.floor(Math.random() * 2 ** 31);
  return {
    versao: 1,
    id: uid(),
    criadoEm: Date.now(),
    dono: { nome: dono, aniversario: aniversario || "" },
    bubu: { nome: bubu || "Bubu", cor, nascimento: null, calor: 0, geracao: 1, seed, personalidade: randomTemperament(seed) },
    needs: { fome: 80, energia: 90, higiene: 100, diversao: 70, afeto: 60, saude: 100 },
    idadeH: 0,
    moedas: 60,
    comidas: { maca: 3, banana: 2, leite: 2, pao: 1, cenoura: 1 },
    roupas: [],
    cores: ["marrom", "pessego", "lilas", "menta", "ceu", "rosa", "banana"],
    roupa: {},
    luz: true,
    dormindo: false,
    doente: false,
    ultimoTick: Date.now(),
    brain: null,
    mente: { memorias: {}, palavras: {}, truques: {}, perguntadas: [], inteligencia: 0 },
    diario: [],
    stats: { comidas: 0, banhos: 0, jogos: 0, carinhos: 0, perguntas: 0, recorde: {} },
    config: { ritmo: 1, voz: true, som: true },
    memorial: [],
  };
}

/** Personalidade: ganhos nas emoções (cada Bubu nasce diferente). */
export function randomTemperament(seed) {
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const g = () => +(0.75 + r() * 0.6).toFixed(2);
  return { CURIOSO: g(), BRINCALHAO: g(), CALMA: g(), MEDO: g(), CARENCIA: g(), FRUSTRACAO: g(), TRISTEZA: g(), SONO: g() };
}

export function exportSave(save) {
  return JSON.stringify(save);
}

export function importSave(text) {
  const s = JSON.parse(text);
  if (!s || !s.id || !s.bubu || !s.needs) throw new Error("Arquivo de save inválido");
  return s;
}
