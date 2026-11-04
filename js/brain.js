/**
 * CÉREBRO DO BUBU: uma rede neural pulsada (neurônios de integração e disparo com vazamento, LIF).
 *
 * Adaptado da rede do Pestinha (https://github.com/mille-okws/pestinha, GPL-3.0), que roda no
 * notebook com Python/numpy. Aqui ela foi reescrita em JavaScript puro para rodar no celular, e os
 * sentidos mudaram: em vez de janelas e teclado, o Bubu sente fome, sono, sujeira, carinho...
 *
 *   necessidades e você ──► sentidos (0..1) ──► neurônios sensoriais (Poisson, com habituação)
 *                                                    │
 *                                                    ▼
 *                                interneurônios (alegria, medo, curiosidade, tristeza...)
 *                                                    │
 *                                                    ▼
 *                  motores de expressão (a cara)       motores de decisão (passear, pedir ajuda...)
 *
 * Mecanismos: vazamento, limiar, período refratário, ruído, adaptação, inibição lateral,
 * habituação (cutucar demais perde a graça) e aprendizado de três fatores (o que estava
 * acontecendo quando você deu carinho/elogio passa a deixá-lo feliz; bronca faz o contrário).
 */

import { mulberry32 } from "./util.js";

// ---------- sentidos: nome -> [neurônios, taxa máx Hz, habituação d, recuperação s, descrição]
export const SENSES = {
  FOME:      [6, 60, 0, 1, "barriga vazia"],
  CANSACO:   [6, 50, 0, 1, "pouca energia"],
  SUJEIRA:   [6, 40, 0, 1, "está sujinho"],
  TEDIO:     [6, 60, 0, 1, "nada pra fazer"],
  SOLIDAO:   [6, 50, 0, 1, "sente sua falta"],
  DOENTE:    [6, 50, 0, 1, "não está bem"],
  CARINHO:   [6, 70, 0, 1, "você fazendo carinho"],
  CUTUCADA:  [6, 90, 0.0012, 120, "você cutucou"],
  COMIDA:    [6, 80, 0.0004, 300, "comendo"],
  BRINCAR:   [6, 80, 0.0002, 600, "brincando com você"],
  NOVIDADE:  [6, 90, 0.0005, 600, "algo novo"],
  ESCURO:    [6, 40, 0, 1, "luz apagada"],
  ELOGIO:    [6, 80, 0, 1, "você respondeu / elogiou"],
  BRONCA:    [6, 90, 0.0003, 900, "levou bronca"],
  BANHO:     [6, 70, 0.0003, 300, "tomando banho"],
  BEM_ESTAR: [6, 40, 0, 1, "tudo em ordem"],
};

// ---------- interneurônios: [nome, tipo, n, tau_m ms, adapt_b, adapt_tau s, apelido]
export const INTER = [
  ["ALERTA",     "exc", 14,  20, 0.03, 1.5, "alerta"],
  ["CURIOSO",    "exc", 14,  80, 0.02, 2.0, "curiosidade"],
  ["BRINCALHAO", "exc", 12,  60, 0.02, 2.0, "vontade de brincar"],
  ["CALMA",      "exc", 12, 300, 0.01, 3.0, "calma"],
  ["SONO",       "exc", 12, 400, 0.01, 3.0, "sono"],
  ["FRUSTRACAO", "exc", 12, 300, 0.01, 3.0, "frustração"],
  ["TRISTEZA",   "exc", 12, 400, 0.01, 4.0, "tristeza"],
  ["MEDO",       "exc", 10, 100, 0.02, 2.0, "medo"],
  ["CARENCIA",   "exc", 10, 300, 0.01, 3.0, "carência"],
  ["QUIETUDE",   "inh", 12,  30, 0.00, 1.0, "quietude"],
  ["INIBE",      "inh", 18,  10, 0.00, 1.0, "inibição"],
];

// ---------- motores: [nome, n, tau_m, adapt_b, adapt_tau, grupo]
export const MOTORS = [
  ["FELIZ",     10, 50, 0.04, 3, "expr"],
  ["CURIOSIDADE", 10, 50, 0.05, 3, "expr"],
  ["BRAVO",     10, 50, 0.03, 4, "expr"],
  ["TRISTE",    10, 80, 0.02, 5, "expr"],
  ["SONOLENTO", 10, 80, 0.02, 5, "expr"],
  ["ASSUSTADO", 10, 25, 0.06, 1, "expr"],
  ["SERENO",    10, 60, 0.03, 4, "expr"],
  ["PASSEAR",   10, 50, 0.05, 3, "dec"],
  ["PEDIR_AJUDA", 10, 80, 0.02, 4, "dec"],
  ["PERGUNTAR", 10, 60, 0.03, 4, "dec"],
  ["BRINCAR_SOZINHO", 10, 60, 0.03, 4, "dec"],
  ["COCHILAR",  10, 80, 0.02, 5, "dec"],
];

// ---------- conexões: [pré, pós, peso (fração do limiar), densidade]
export const CONNECTIONS = [
  // sentidos -> interneurônios
  ["FOME", "FRUSTRACAO", 0.07, 0.6], ["FOME", "CARENCIA", 0.05, 0.6], ["FOME", "BRINCALHAO", -0.04, 0.6],
  ["CANSACO", "SONO", 0.10, 0.6], ["CANSACO", "QUIETUDE", 0.04, 0.6],
  ["SUJEIRA", "FRUSTRACAO", 0.04, 0.6], ["SUJEIRA", "CARENCIA", 0.03, 0.6],
  ["TEDIO", "CURIOSO", 0.12, 0.6], ["TEDIO", "BRINCALHAO", 0.08, 0.6], ["TEDIO", "TRISTEZA", 0.02, 0.6],
  ["SOLIDAO", "TRISTEZA", 0.08, 0.6], ["SOLIDAO", "CARENCIA", 0.09, 0.6],
  ["DOENTE", "TRISTEZA", 0.06, 0.6], ["DOENTE", "CARENCIA", 0.07, 0.6], ["DOENTE", "SONO", 0.05, 0.6],
  ["CARINHO", "CALMA", 0.08, 0.6], ["CARINHO", "BRINCALHAO", 0.05, 0.6], ["CARINHO", "TRISTEZA", -0.06, 0.6],
  ["CARINHO", "CARENCIA", -0.10, 0.6],
  ["CUTUCADA", "ALERTA", 0.09, 0.6], ["CUTUCADA", "BRINCALHAO", 0.08, 0.6], ["CUTUCADA", "CURIOSO", 0.04, 0.6],
  ["COMIDA", "CALMA", 0.06, 0.6], ["COMIDA", "BRINCALHAO", 0.06, 0.6], ["COMIDA", "FRUSTRACAO", -0.08, 0.6],
  ["BRINCAR", "BRINCALHAO", 0.12, 0.6], ["BRINCAR", "ALERTA", 0.03, 0.6], ["BRINCAR", "TRISTEZA", -0.06, 0.6],
  ["NOVIDADE", "CURIOSO", 0.12, 0.6], ["NOVIDADE", "ALERTA", 0.07, 0.6],
  ["ESCURO", "SONO", 0.08, 0.6], ["ESCURO", "QUIETUDE", 0.08, 0.6], ["ESCURO", "MEDO", 0.02, 0.6],
  ["ELOGIO", "BRINCALHAO", 0.07, 0.6], ["ELOGIO", "CALMA", 0.05, 0.6], ["ELOGIO", "CURIOSO", 0.05, 0.6],
  ["ELOGIO", "CARENCIA", -0.08, 0.6],
  ["BRONCA", "MEDO", 0.10, 0.6], ["BRONCA", "TRISTEZA", 0.06, 0.6], ["BRONCA", "FRUSTRACAO", 0.05, 0.6],
  ["BEM_ESTAR", "CALMA", 0.05, 0.6], ["BEM_ESTAR", "BRINCALHAO", 0.04, 0.6],
  ["BANHO", "CALMA", 0.05, 0.6], ["BANHO", "BRINCALHAO", 0.06, 0.6], ["BANHO", "ALERTA", 0.03, 0.6],

  // interneurônios entre si
  ["SONO", "TRISTEZA", 0.02, 0.5], ["SONO", "ALERTA", -0.05, 0.5], ["SONO", "BRINCALHAO", -0.06, 0.5],
  ["SONO", "CURIOSO", -0.05, 0.5],
  ["FRUSTRACAO", "INIBE", 0.04, 0.5], ["FRUSTRACAO", "CALMA", -0.06, 0.5], ["FRUSTRACAO", "BRINCALHAO", -0.05, 0.5],
  ["TRISTEZA", "BRINCALHAO", -0.06, 0.5], ["TRISTEZA", "CURIOSO", -0.04, 0.5],
  ["BRINCALHAO", "TRISTEZA", -0.05, 0.5], ["CALMA", "FRUSTRACAO", -0.04, 0.5], ["CALMA", "MEDO", -0.06, 0.5],
  ["CALMA", "ALERTA", -0.05, 0.5], ["MEDO", "ALERTA", 0.06, 0.5], ["MEDO", "BRINCALHAO", -0.05, 0.5],
  ["ALERTA", "CURIOSO", 0.05, 0.4], ["ALERTA", "INIBE", 0.10, 0.5],
  ["CURIOSO", "INIBE", 0.06, 0.5], ["BRINCALHAO", "INIBE", 0.06, 0.5],
  ["QUIETUDE", "ALERTA", -0.05, 0.5], ["QUIETUDE", "CURIOSO", -0.05, 0.5], ["QUIETUDE", "BRINCALHAO", -0.04, 0.5],
  ["INIBE", "ALERTA", -0.04, 0.5], ["INIBE", "CURIOSO", -0.03, 0.5], ["INIBE", "BRINCALHAO", -0.03, 0.5],
  ["CARENCIA", "TRISTEZA", 0.03, 0.5],

  // interneurônios -> motores de expressão
  ["BRINCALHAO", "FELIZ", 0.65, 0.6], ["CALMA", "FELIZ", 0.10, 0.6],
  ["CURIOSO", "CURIOSIDADE", 0.40, 0.6], ["ALERTA", "CURIOSIDADE", 0.10, 0.6],
  ["FRUSTRACAO", "BRAVO", 0.55, 0.6], ["ALERTA", "BRAVO", 0.04, 0.6],
  ["TRISTEZA", "TRISTE", 0.45, 0.6], ["CARENCIA", "TRISTE", 0.12, 0.6],
  ["SONO", "SONOLENTO", 0.35, 0.6], ["CALMA", "SONOLENTO", 0.04, 0.6],
  ["MEDO", "ASSUSTADO", 0.50, 0.6], ["ALERTA", "ASSUSTADO", 0.12, 0.6],
  ["CALMA", "SERENO", 0.45, 0.6],
  ["INIBE", "FELIZ", -0.08, 0.5], ["INIBE", "CURIOSIDADE", -0.08, 0.5], ["INIBE", "ASSUSTADO", -0.08, 0.5],
  ["INIBE", "BRAVO", -0.04, 0.5],

  // interneurônios -> decisões
  ["CURIOSO", "PASSEAR", 0.35, 0.6], ["BRINCALHAO", "PASSEAR", 0.12, 0.6], ["SONO", "PASSEAR", -0.30, 0.6],
  ["TRISTEZA", "PASSEAR", -0.15, 0.6],
  ["CARENCIA", "PEDIR_AJUDA", 0.45, 0.6], ["FRUSTRACAO", "PEDIR_AJUDA", 0.20, 0.6], ["MEDO", "PEDIR_AJUDA", 0.15, 0.6],
  ["CALMA", "PEDIR_AJUDA", -0.20, 0.5],
  ["CURIOSO", "PERGUNTAR", 0.40, 0.6], ["CARENCIA", "PERGUNTAR", 0.08, 0.6], ["SONO", "PERGUNTAR", -0.35, 0.6],
  ["FRUSTRACAO", "PERGUNTAR", -0.30, 0.6], ["MEDO", "PERGUNTAR", -0.25, 0.6],
  ["BRINCALHAO", "BRINCAR_SOZINHO", 0.40, 0.6], ["TRISTEZA", "BRINCAR_SOZINHO", -0.40, 0.6],
  ["SONO", "BRINCAR_SOZINHO", -0.30, 0.6],
  ["SONO", "COCHILAR", 0.50, 0.6], ["QUIETUDE", "COCHILAR", 0.06, 0.6], ["ALERTA", "COCHILAR", -0.30, 0.6],
  ["BRINCALHAO", "COCHILAR", -0.20, 0.6],
];

// o que pode ser aprendido: sentido -> estas emoções (sinal: + bom, − ruim)
const PLASTIC_POSTS = { BRINCALHAO: 1, CALMA: 1, FRUSTRACAO: -1, TRISTEZA: -1, MEDO: -1 };
const PLASTIC_DENSITY = 0.5;
const LEARN_MIN = -0.06, LEARN_MAX = 0.08;
const ELIGIBILITY_TAU = 4;          // s
const LATERAL = 0.05;               // inibição entre motores do mesmo grupo
const T_REF = 3;                    // ms refratário
const NOISE = 0.025;
const READ_TAU = 0.5;               // s, suavização das taxas

/** Ruído normal (Box-Muller) usando Math.random: o comportamento nunca é idêntico. */
function gauss() {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

export class Brain {
  /**
   * seed: define a fiação (cada Bubu tem a sua).
   * temperament: { INTERNEURONIO: ganho } multiplica o que sai dos sentidos (personalidade).
   */
  constructor(seed = 1, temperament = {}) {
    this.seed = seed;
    this.temperament = { ...temperament };
    const rng = mulberry32(seed);
    const lognorm = () => Math.exp(0.25 * gaussR(rng)) / Math.exp(0.25 ** 2 / 2);

    this.pools = [];
    this.index = {};
    let cursor = 0;
    const add = (name, group, n, kind) => {
      this.index[name] = this.pools.length;
      this.pools.push({ name, group, n, kind, start: cursor });
      cursor += n;
    };
    this.senseNames = Object.keys(SENSES);
    for (const s of this.senseNames) add(s, "sens", SENSES[s][0], "sens");
    for (const [name, kind, n] of INTER) add(name, "inter", n, kind);
    for (const [name, n, , , , grp] of MOTORS) add(name, grp, n, "exc");
    this.motorNames = MOTORS.map((m) => m[0]);
    this.N = cursor;
    this.Ns = this.senseNames.reduce((a, s) => a + SENSES[s][0], 0);

    const N = this.N, Ns = this.Ns;
    this.decay = new Float32Array(N);
    this.adaptB = new Float32Array(N);
    this.adaptDecay = new Float32Array(N);
    const setPool = (name, tau, b, bt) => {
      const p = this.pool(name);
      for (let i = p.start; i < p.start + p.n; i++) {
        const t = tau * (0.9 + 0.2 * rng());
        this.decay[i] = Math.exp(-1 / t);
        this.adaptB[i] = b;
        this.adaptDecay[i] = Math.exp(-1 / (bt * 1000));
      }
    };
    for (const [name, , , tau, b, bt] of INTER) setPool(name, tau, b, bt);
    for (const [name, , tau, b, bt] of MOTORS) setPool(name, tau, b, bt);

    this.sRate = new Float32Array(Ns);
    this.sD = new Float32Array(Ns);
    this.sRec = new Float32Array(Ns);
    for (const s of this.senseNames) {
      const p = this.pool(s);
      const [, rate, d, rec] = SENSES[s];
      for (let i = p.start; i < p.start + p.n; i++) {
        this.sRate[i] = rate; this.sD[i] = d; this.sRec[i] = 0.001 / rec;
      }
    }

    // sinapses em lista esparsa por neurônio pré: [pós, peso]
    this.base = Array.from({ length: N }, () => new Map());
    const connect = (pre, post, w, dens, r = rng) => {
      const a = this.pool(pre), b = this.pool(post);
      for (let i = 0; i < a.n; i++)
        for (let j = 0; j < b.n; j++)
          if (r() < dens) {
            const m = this.base[a.start + i];
            const k = b.start + j;
            m.set(k, (m.get(k) || 0) + w * lognorm());
          }
    };
    for (let [pre, post, w, dens] of CONNECTIONS) {
      if (SENSES[pre]) w *= this.temperament[post] ?? 1;
      connect(pre, post, w, dens);
    }
    for (const groupName of ["expr", "dec"]) {
      const ms = MOTORS.filter((m) => m[5] === groupName).map((m) => m[0]);
      for (const a of ms) for (const b of ms) if (a !== b) connect(a, b, a === "ASSUSTADO" ? -0.1 : -LATERAL, 0.7);
    }

    // sinapses plásticas (rng próprio, para não mudar o resto)
    const prng = mulberry32(seed + 1);
    this.plasticPosts = Object.keys(PLASTIC_POSTS);
    this.postSign = this.plasticPosts.map((p) => PLASTIC_POSTS[p]);
    this.plasticMasks = []; // [canal][post] -> lista [pre, pos, força]
    for (const s of this.senseNames) {
      const a = this.pool(s);
      const row = [];
      for (const post of this.plasticPosts) {
        const b = this.pool(post);
        const list = [];
        for (let i = 0; i < a.n; i++)
          for (let j = 0; j < b.n; j++)
            if (prng() < PLASTIC_DENSITY) list.push([a.start + i, b.start + j, Math.exp(0.25 * gaussR(prng)) / Math.exp(0.03125)]);
        row.push(list);
      }
      this.plasticMasks.push(row);
    }
    this.learned = this.senseNames.map(() => this.plasticPosts.map(() => 0));
    this.eligibility = new Float32Array(this.senseNames.length);
    this.levels = new Float32Array(this.senseNames.length);
    this._rebuild();

    // estado
    this.v = new Float32Array(N);
    this.a = new Float32Array(N);
    this.ref = new Uint8Array(N);
    this.spikes = new Uint8Array(N);
    this.gain = new Float32Array(N).fill(1); // eficácia de saída (habituação dos sentidos)
    this.sProb = new Float32Array(Ns);
    this.poolOf = new Uint16Array(N);
    this.pools.forEach((p, k) => { for (let i = p.start; i < p.start + p.n; i++) this.poolOf[i] = k; });
    this.counts = new Float32Array(this.pools.length);
    this.rate = new Float32Array(this.pools.length);
    this.timeMs = 0;
    this.lastSpikes = new Uint8Array(N); // para desenhar
  }

  pool(name) { return this.pools[this.index[name]]; }

  /** Recalcula as sinapses (base + aprendidas) em arrays compactos. */
  _rebuild() {
    const maps = this.base.map((m) => new Map(m));
    this.senseNames.forEach((_, c) => this.plasticPosts.forEach((_, p) => {
      const w = this.learned[c][p];
      if (!w) return;
      for (const [i, j, s] of this.plasticMasks[c][p]) maps[i].set(j, (maps[i].get(j) || 0) + w * s);
    }));
    this.out = maps.map((m) => ({ idx: Int32Array.from(m.keys()), w: Float32Array.from(m.values()) }));
    this.nSynapses = this.out.reduce((a, o) => a + o.idx.length, 0);
  }

  /** intensidades {SENTIDO: 0..1} */
  stimulate(levels) {
    this.senseNames.forEach((s, k) => {
      let x = Number(levels[s] || 0);
      x = x < 0 ? 0 : x > 1 ? 1 : x;
      this.levels[k] = x;
      const p = this.pool(s);
      for (let i = p.start; i < p.start + p.n; i++) this.sProb[i] = this.sRate[i] * x * 0.001;
    });
  }

  _substep() {
    const { N, Ns, v, a, ref, spikes, gain, out, decay, adaptB, adaptDecay } = this;
    const drive = this._drive || (this._drive = new Float32Array(N));
    drive.fill(0);
    for (let i = 0; i < N; i++) {
      if (!spikes[i]) continue;
      const o = out[i], g = gain[i];
      for (let k = 0; k < o.idx.length; k++) drive[o.idx[k]] += o.w[k] * g;
    }
    for (let i = 0; i < Ns; i++) {
      const fired = Math.random() < this.sProb[i] ? 1 : 0;
      spikes[i] = fired;
      if (fired) { gain[i] *= 1 - this.sD[i]; this.counts[this.poolOf[i]]++; this.lastSpikes[i] = 1; }
      gain[i] += (1 - gain[i]) * this.sRec[i];
    }
    for (let i = Ns; i < N; i++) {
      let x = v[i] * decay[i] + drive[i] + NOISE * gauss();
      if (ref[i] > 0) { x = 0; ref[i]--; }
      if (x < -0.5) x = -0.5;
      a[i] *= adaptDecay[i];
      if (x >= 1 + a[i]) {
        x = 0; ref[i] = T_REF; a[i] += adaptB[i]; spikes[i] = 1;
        this.counts[this.poolOf[i]]++; this.lastSpikes[i] = 1;
      } else spikes[i] = 0;
      v[i] = x;
    }
  }

  /** avança dt_ms (passos de 1 ms, no máximo 400) */
  step(dtMs) {
    const n = Math.max(1, Math.min(400, Math.round(dtMs)));
    for (let i = 0; i < n; i++) this._substep();
    const dt = n / 1000;
    const alpha = 1 - Math.exp(-dt / READ_TAU);
    this.pools.forEach((p, k) => {
      const r = this.counts[k] / (dt * p.n);
      this.rate[k] += alpha * (r - this.rate[k]);
      this.counts[k] = 0;
    });
    this.timeMs += n;
  }

  motors() {
    const o = {};
    for (const m of this.motorNames) o[m] = this.rate[this.index[m]];
    return o;
  }

  rates() {
    const o = {};
    this.pools.forEach((p, k) => (o[p.name] = this.rate[k]));
    return o;
  }

  /** reward: + carinho/elogio, − bronca. Chamar a cada tick (atualiza elegibilidade). */
  learn(reward, dtS, lr = 0.02) {
    const k = 1 - Math.exp(-dtS / ELIGIBILITY_TAU);
    for (let c = 0; c < this.levels.length; c++) this.eligibility[c] += (this.levels[c] - this.eligibility[c]) * k;
    if (!reward) return false;
    let changed = false;
    for (let c = 0; c < this.levels.length; c++) {
      if (this.eligibility[c] < 0.02) continue;
      for (let p = 0; p < this.plasticPosts.length; p++) {
        const nv = clamp(this.learned[c][p] + lr * reward * dtS * this.eligibility[c] * this.postSign[p], LEARN_MIN, LEARN_MAX);
        if (nv !== this.learned[c][p]) { this.learned[c][p] = nv; changed = true; }
      }
    }
    if (changed) this._rebuild();
    return changed;
  }

  /** associações mais fortes aprendidas: [{sentido, emocao, peso}] */
  learnedSummary(top = 5) {
    const list = [];
    this.senseNames.forEach((s, c) => this.plasticPosts.forEach((p, j) => {
      const w = this.learned[c][j];
      if (Math.abs(w) > 0.002) list.push({ sentido: s, emocao: p, peso: w });
    }));
    return list.sort((x, y) => Math.abs(y.peso) - Math.abs(x.peso)).slice(0, top);
  }

  toJSON() {
    return {
      seed: this.seed, temperament: this.temperament, learned: this.learned,
      gain: Array.from(this.gain.slice(0, this.Ns), (x) => +x.toFixed(4)),
    };
  }

  static fromJSON(d) {
    const b = new Brain(d.seed, d.temperament || {});
    if (Array.isArray(d.learned) && d.learned.length === b.learned.length) {
      b.learned = d.learned.map((row) => row.map((x) => clamp(Number(x) || 0, LEARN_MIN, LEARN_MAX)));
      b._rebuild();
    }
    if (Array.isArray(d.gain)) d.gain.forEach((g, i) => i < b.Ns && (b.gain[i] = clamp(Number(g) || 1, 0, 1)));
    return b;
  }
}

function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
function gaussR(rng) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Lê os motores e devolve a emoção dominante (ou "neutro"). */
export function dominantEmotion(motors, min = 4) {
  const expr = MOTORS.filter((m) => m[5] === "expr").map((m) => m[0]);
  let best = "neutro", bv = min;
  for (const m of expr) if (motors[m] > bv) { bv = motors[m]; best = m; }
  return best;
}
