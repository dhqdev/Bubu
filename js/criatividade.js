/**
 * CRIATIVIDADE DO BUBU: ele junta o que aprendeu com você e cria coisas novas.
 *
 * - Frases e poemas: uma cadeia de Markov aprende com tudo o que você escreve para ele
 *   (as palavras que você usa, em que ordem). Quanto mais você conversa, mais ele fala do seu jeito.
 * - Desenhos: usa as cores e as coisas que ele conhece (palavras que você ensinou) para pintar.
 * - Invenções: mistura duas palavras que ele sabe e inventa uma coisa nova.
 * - Músicas: transforma uma palavra em melodia.
 * - Gosto: quando você dá 👍 ele faz mais daquele tipo; 👎, menos.
 */
import { norm, pick, mulberry32 } from "./util.js";

const STOP = new Set("a o os as um uma uns umas de da do das dos e é eh que em no na nos nas pra para por com se eu tu ele ela voce vc me te lhe mas ou ja nao sim isso esse essa este esta aquilo la aqui".split(" "));

const COR_PALAVRA = {
  azul: "#4f8cf0", vermelho: "#e2394f", vermelha: "#e2394f", verde: "#4fbf6a", amarelo: "#ffd84d", amarela: "#ffd84d",
  rosa: "#ff8fb1", roxo: "#8b5cf0", roxa: "#8b5cf0", lilas: "#b9a3ff", laranja: "#ff9a3c", preto: "#2a2433", preta: "#2a2433",
  branco: "#ffffff", branca: "#ffffff", marrom: "#a5743f", cinza: "#9aa0ad", dourado: "#e0a62a", prata: "#c9cbd8", turquesa: "#3cc8c8",
};
const EMOJI_PALAVRA = {
  gato: "🐱", gata: "🐱", cachorro: "🐶", cachorra: "🐶", sol: "☀️", lua: "🌙", estrela: "⭐", estrelas: "⭐", mar: "🌊", chuva: "🌧️",
  flor: "🌸", flores: "🌸", arvore: "🌳", casa: "🏠", coracao: "❤️", carro: "🚗", bola: "⚽", musica: "🎵", pizza: "🍕", bolo: "🍰",
  amor: "💖", amigo: "🤝", amiga: "🤝", amizade: "🤝", escola: "🏫", livro: "📚", peixe: "🐟", passaro: "🐦", nuvem: "☁️", fogo: "🔥",
  dinheiro: "💰", futebol: "⚽", praia: "🏖️", montanha: "⛰️", ceu: "🌌", comida: "🍽️", sorvete: "🍦", chocolate: "🍫", cafe: "☕",
  trabalho: "💼", computador: "💻", celular: "📱", jogo: "🎮", dormir: "😴", sonho: "💭", saudade: "🥺", tempo: "⏳", arco: "🌈",
  borboleta: "🦋", abelha: "🐝", dinossauro: "🦕", robo: "🤖", foguete: "🚀", planeta: "🪐", neve: "❄️", vento: "🍃", rio: "🏞️",
  cavalo: "🐴", coelho: "🐰", urso: "🐻", leao: "🦁", tartaruga: "🐢", banana: "🍌", maca: "🍎", morango: "🍓", uva: "🍇",
};
const TIPOS = ["frase", "poema", "desenho", "invencao", "musica"];
const NOME_TIPO = { frase: "Pensamento", poema: "Poema", desenho: "Desenho", invencao: "Invenção", musica: "Música" };
export { NOME_TIPO };

function mem(save) {
  const m = save.mente;
  m.markov ||= {};
  m.criacoes ||= [];
  m.gosto ||= Object.fromEntries(TIPOS.map((t) => [t, 1]));
  return m;
}

/** Aprende com um texto que você escreveu (ordem das palavras). */
export function aprenderTexto(save, texto) {
  const m = mem(save);
  // guarda as palavras com acento (para ele escrever bonito); só tira pontuação
  const words = String(texto).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 40);
  if (words.length < 2) return;
  const mk = m.markov;
  const seq = ["^", ...words, "$"];
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i], b = seq[i + 1];
    const row = (mk[a] ||= {});
    row[b] = (row[b] || 0) + 1;
    // limite de tamanho: esquece as transições mais raras
    const keys = Object.keys(row);
    if (keys.length > 24) {
      const rare = keys.sort((x, y) => row[x] - row[y])[0];
      delete row[rare];
    }
  }
  const all = Object.keys(mk);
  if (all.length > 900) for (const k of all.slice(0, all.length - 900)) if (k !== "^") delete mk[k];
}

/** Quantas coisas ele sabe (para o sentido SABER da rede). */
export function saber(save) {
  const m = mem(save);
  const n = Object.keys(m.palavras).length + Object.keys(m.memorias).length + Object.keys(m.markov).length / 10 + m.criacoes.length / 2;
  return Math.min(1, n / 25);
}

function walk(mk, start, max = 12) {
  const out = [];
  let w = start;
  for (let i = 0; i < max; i++) {
    const row = mk[w];
    if (!row) break;
    const entries = Object.entries(row);
    let total = entries.reduce((a, [, c]) => a + c, 0);
    let r = Math.random() * total;
    let next = entries[0][0];
    for (const [k, c] of entries) if ((r -= c) <= 0) { next = k; break; }
    if (next === "$") break;
    out.push(next);
    w = next;
  }
  return out.join(" ");
}

function vocab(save) {
  const m = mem(save);
  const set = new Set();
  for (const k of Object.keys(m.palavras)) set.add(norm(k));
  for (const v of Object.values(m.memorias)) norm(v).split(" ").forEach((w) => set.add(w));
  for (const k of Object.keys(m.markov)) set.add(k);
  return [...set].filter((w) => w && w.length > 2 && !STOP.has(norm(w)) && w !== "^" && w !== "$");
}

function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

function podeCriar(save, tipo) {
  const m = mem(save);
  if (tipo === "frase" || tipo === "poema") return Object.keys(m.markov).length >= (tipo === "poema" ? 15 : 6);
  if (tipo === "invencao") return Object.keys(m.palavras).length >= 2;
  return true;
}

/** Cria uma coisa nova. Devolve a criação (já guardada) ou null. */
export function criar(save, tipoForcado) {
  const m = mem(save);
  const opcoes = TIPOS.filter((t) => podeCriar(save, t));
  if (!opcoes.length) return null;
  let tipo = tipoForcado && opcoes.includes(tipoForcado) ? tipoForcado : null;
  if (!tipo) {
    const total = opcoes.reduce((a, t) => a + m.gosto[t], 0);
    let r = Math.random() * total;
    tipo = opcoes.find((t) => (r -= m.gosto[t]) <= 0) || opcoes[0];
  }
  const dono = save.dono.nome;
  const v = vocab(save);
  const seed = Math.floor(Math.random() * 1e9);
  let c = { id: seed.toString(36), tipo, em: Date.now(), gostou: null };

  if (tipo === "frase") {
    let t = "";
    for (let i = 0; i < 5 && t.split(" ").length < 3; i++) t = walk(m.markov, "^", 14);
    c.titulo = "Um pensamento";
    c.texto = cap(t || pick(v) || "bubu") + pick(["!", "...", "?", "! 💭"]);
  } else if (tipo === "poema") {
    const linhas = [];
    for (let i = 0; i < 3; i++) {
      const start = pick(v.filter((w) => m.markov[w])) || "^";
      const l = walk(m.markov, start, 7);
      linhas.push(cap(((start !== "^" ? start + " " : "") + l).trim()));
    }
    c.titulo = `Poema para ${dono}`;
    c.texto = linhas.filter(Boolean).join("\n") + `\n— com amor, ${save.bubu.nome}`;
  } else if (tipo === "invencao") {
    const ps = Object.values(m.palavras);
    const a = pick(ps);
    let b = pick(ps);
    for (let i = 0; i < 5 && b === a; i++) b = pick(ps);
    const curta = (s) => String(s.significado).split(/[,.;]/)[0].toLowerCase();
    c.titulo = `${cap(a.palavra)}-${b.palavra}`;
    c.texto = `Inventei o ${a.palavra}-${b.palavra}! É ${curta(a)}, mas também ${curta(b)}. ${pick(["Genial, né?", "Vou ficar rico!", "Ninguém nunca pensou nisso!", "Quer testar?"])}`;
    c.emojis = [EMOJI_PALAVRA[norm(a.palavra)] || "✨", EMOJI_PALAVRA[norm(b.palavra)] || "🔧"];
  } else if (tipo === "desenho") {
    const cores = v.map((w) => COR_PALAVRA[norm(w)]).filter(Boolean);
    const fav = COR_PALAVRA[norm(save.mente.memorias.cor_favorita || "").split(" ")[0]];
    if (fav) cores.unshift(fav);
    const coisas = [...new Set(v.map((w) => EMOJI_PALAVRA[norm(w)]).filter(Boolean))];
    const tema = pick(coisas.length ? coisas : ["🌱", "⭐", "🌸"]);
    c.titulo = `Desenho: ${tema}`;
    c.desenho = { seed, cores: cores.slice(0, 4), coisas: coisas.slice(0, 6), tema };
    c.texto = pick(["Fiz pra você!", "Gostou do meu desenho?", "Ficou bonito?", `É você, ${dono}!`]);
  } else {
    const w = pick(v) || save.bubu.nome.toLowerCase();
    const escala = [0, 2, 4, 7, 9, 12, 14, 16];
    c.titulo = `Canção do(a) ${w}`;
    c.notas = [...w].slice(0, 14).map((ch) => escala[ch.charCodeAt(0) % escala.length]);
    c.texto = "Escuta só! 🎵";
  }
  m.criacoes.unshift(c);
  m.criacoes = m.criacoes.slice(0, 60);
  m.inteligencia += 1;
  return c;
}

/** Você gostou (ou não): ele ajusta o gosto e reforça as palavras usadas. */
export function avaliar(save, id, bom) {
  const m = mem(save);
  const c = m.criacoes.find((x) => x.id === id);
  if (!c || c.gostou !== null) return null;
  c.gostou = bom;
  m.gosto[c.tipo] = Math.max(0.2, Math.min(6, m.gosto[c.tipo] * (bom ? 1.35 : 0.75)));
  if (bom && c.texto && (c.tipo === "frase" || c.tipo === "poema")) aprenderTexto(save, c.texto.split("\n—")[0]);
  return c;
}

/** Desenho gerado a partir das cores e das coisas que ele conhece. */
export function desenhoSVG(d) {
  const r = mulberry32(d.seed);
  const cores = d.cores?.length ? d.cores : ["#ff8fb1", "#ffd84d", "#7cc7ff", "#8edb83"];
  const fundo = ["#fff8ec", "#eef7ff", "#f6f0ff", "#effff4"][Math.floor(r() * 4)];
  let s = `<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg" class="desenho"><rect width="200" height="150" rx="10" fill="${fundo}"/>`;
  // rabiscos de giz
  for (let i = 0; i < 6; i++) {
    const c = cores[Math.floor(r() * cores.length)];
    const x = r() * 200, y = r() * 150;
    s += `<path d="M${x} ${y} q${r() * 60 - 30} ${r() * 60 - 30} ${r() * 80 - 40} ${r() * 40 - 20} t${r() * 60 - 30} ${r() * 40 - 20}" stroke="${c}" stroke-width="${3 + r() * 4}" fill="none" stroke-linecap="round" opacity=".75"/>`;
  }
  for (let i = 0; i < 5; i++) {
    const c = cores[Math.floor(r() * cores.length)];
    s += `<circle cx="${r() * 200}" cy="${r() * 150}" r="${4 + r() * 14}" fill="${c}" opacity=".55"/>`;
  }
  // chão e as coisas
  s += `<path d="M0 128 Q100 ${110 + r() * 20} 200 128 V150 H0Z" fill="${cores[0]}" opacity=".35"/>`;
  const itens = [d.tema, ...(d.coisas || [])].slice(0, 5);
  itens.forEach((e, i) => {
    const size = i === 0 ? 46 : 22 + r() * 10;
    s += `<text x="${i === 0 ? 100 : 20 + r() * 160}" y="${i === 0 ? 92 : 30 + r() * 80}" font-size="${size}" text-anchor="middle">${e}</text>`;
  });
  return s + `</svg>`;
}

let audio;
/** Toca uma música (Web Audio, sem arquivos). */
export function tocar(notas) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audio.currentTime + 0.05;
    notas.forEach((n, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = i % 4 === 3 ? "square" : "triangle";
      o.frequency.value = 523.25 * Math.pow(2, n / 12);
      g.gain.setValueAtTime(0, t0 + i * 0.22);
      g.gain.linearRampToValueAtTime(0.15, t0 + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.22 + 0.2);
      o.connect(g).connect(audio.destination);
      o.start(t0 + i * 0.22);
      o.stop(t0 + i * 0.22 + 0.22);
    });
  } catch { /* sem áudio */ }
}
