/**
 * Sons do Bubu, todos sintetizados na hora com WebAudio (sem arquivos de áudio).
 * O navegador só libera o som depois do primeiro toque na tela, então `destravar()`
 * é chamado no primeiro pointerdown.
 */
let ctx = null;
let master = null;
let ligado = true;

export function setLigado(v) { ligado = v !== false; }

export function destravar() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (!master) { master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination); }
    if (ctx.state === "suspended") ctx.resume();
  } catch { ctx = null; }
}

/** Um bipe com envelope: frequência pode deslizar de f0 para f1. */
function tom(f0, f1 = f0, { dur = 0.15, tipo = "sine", vol = 0.6, quando = 0, ataque = 0.01 } = {}) {
  if (!ligado || !ctx || !master) return;
  const t = ctx.currentTime + quando;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Ruído curto filtrado (mastigar, água, espuma). */
function ruido({ dur = 0.08, freq = 1200, q = 1, vol = 0.5, quando = 0, tipo = "bandpass" } = {}) {
  if (!ligado || !ctx || !master) return;
  const t = ctx.currentTime + quando;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = tipo; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const NOTA = (n) => 440 * 2 ** ((n - 69) / 12);

export const som = {
  toque: () => tom(660, 880, { dur: 0.06, tipo: "triangle", vol: 0.3 }),
  cutucada: () => { tom(300, 720, { dur: 0.12, tipo: "sine", vol: 0.5 }); tom(720, 500, { dur: 0.1, quando: 0.1, vol: 0.3 }); },
  carinho: () => tom(520 + Math.random() * 140, 760, { dur: 0.18, tipo: "sine", vol: 0.25 }),
  comer: () => { for (let i = 0; i < 4; i++) ruido({ dur: 0.07, freq: 900 + Math.random() * 600, q: 2, vol: 0.7, quando: i * 0.18 }); },
  gostou: () => [72, 76, 79].forEach((n, i) => tom(NOTA(n), NOTA(n), { dur: 0.14, tipo: "triangle", vol: 0.35, quando: i * 0.09 })),
  eca: () => tom(260, 140, { dur: 0.35, tipo: "sawtooth", vol: 0.18 }),
  espuma: () => { tom(900 + Math.random() * 900, 1600, { dur: 0.06, vol: 0.12 }); },
  chuveiro: () => { for (let i = 0; i < 14; i++) ruido({ dur: 0.14, freq: 3000, q: 0.6, vol: 0.35, quando: i * 0.12, tipo: "highpass" }); },
  brilho: () => [84, 88, 91, 96].forEach((n, i) => tom(NOTA(n), NOTA(n), { dur: 0.12, vol: 0.18, quando: i * 0.06 })),
  moeda: () => { tom(NOTA(83), NOTA(83), { dur: 0.08, tipo: "square", vol: 0.15 }); tom(NOTA(88), NOTA(88), { dur: 0.25, tipo: "square", vol: 0.15, quando: 0.08 }); },
  comprar: () => { som.moeda(); tom(NOTA(76), NOTA(76), { dur: 0.2, tipo: "triangle", vol: 0.25, quando: 0.25 }); },
  erro: () => { tom(220, 200, { dur: 0.14, tipo: "square", vol: 0.12 }); tom(180, 160, { dur: 0.2, tipo: "square", vol: 0.12, quando: 0.14 }); },
  pulo: () => tom(320, 820, { dur: 0.16, tipo: "square", vol: 0.12 }),
  chute: () => { ruido({ dur: 0.05, freq: 300, vol: 0.9, tipo: "lowpass" }); tom(180, 90, { dur: 0.1, vol: 0.4 }); },
  luzOff: () => tom(500, 200, { dur: 0.25, tipo: "triangle", vol: 0.25 }),
  luzOn: () => tom(200, 600, { dur: 0.2, tipo: "triangle", vol: 0.25 }),
  ovo: () => tom(500 + Math.random() * 200, 600, { dur: 0.08, tipo: "triangle", vol: 0.25 }),
  nascer: () => [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tom(NOTA(n), NOTA(n), { dur: 0.22, tipo: "triangle", vol: 0.3, quando: i * 0.09 })),
  vitoria: () => [67, 72, 76, 79, 84].forEach((n, i) => tom(NOTA(n), NOTA(n), { dur: 0.2, tipo: "square", vol: 0.12, quando: i * 0.1 })),
  pergunta: () => { tom(500, 700, { dur: 0.1, vol: 0.3 }); tom(700, 1000, { dur: 0.14, vol: 0.3, quando: 0.12 }); },
  ouvindo: () => { tom(NOTA(76), NOTA(76), { dur: 0.08, vol: 0.25 }); tom(NOTA(83), NOTA(83), { dur: 0.12, vol: 0.25, quando: 0.09 }); },
  parouOuvir: () => { tom(NOTA(83), NOTA(83), { dur: 0.08, vol: 0.2 }); tom(NOTA(76), NOTA(76), { dur: 0.12, vol: 0.2, quando: 0.09 }); },
  roncar: () => tom(110, 90, { dur: 0.6, tipo: "sawtooth", vol: 0.05, ataque: 0.25 }),
  /** "Voz" de bichinho: bipes por sílaba, com altura que depende da fase da vida. */
  falar: (texto, agudo = 1) => {
    const silabas = Math.min(10, Math.max(2, Math.round(String(texto).replace(/[^\p{L}]/gu, "").length / 3)));
    const base = 420 * agudo;
    const pergunta = /\?\s*$/.test(texto);
    for (let i = 0; i < silabas; i++) {
      const f = base * (1 + (Math.random() - 0.5) * 0.35) * (pergunta && i === silabas - 1 ? 1.4 : 1);
      tom(f, f * (0.85 + Math.random() * 0.3), { dur: 0.07, tipo: "triangle", vol: 0.22, quando: i * 0.085 });
    }
  },
};
