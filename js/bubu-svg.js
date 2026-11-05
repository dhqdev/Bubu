/**
 * Desenho do Bubu em SVG (original): um mochi fofinho com um brotinho na cabeça que cresce
 * com a idade (broto → folhinha → duas folhas → florzinha). Os olhos seguem o dedo,
 * piscam e mudam com o humor. As roupas são camadas por cima.
 */
import { COLORS } from "./items.js";

const INK = "#3b2a3a";

export function colorOf(id) {
  return COLORS.find((c) => c.id === id) || COLORS[0];
}

const BODY = "M100 34 C146 34 176 86 179 136 C181 170 158 182 100 182 C42 182 19 170 21 136 C24 86 54 34 100 34 Z";

function sprout(stage) {
  const stem = `<path d="M100 36 Q98 24 102 14" stroke="#5aa85a" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  const leafR = `<path d="M102 18 C112 6 128 8 130 14 C122 22 110 24 102 18 Z" fill="#7ccf72" stroke="#4f9a4f" stroke-width="1.5"/>`;
  const leafL = `<path d="M100 22 C90 10 74 12 72 18 C80 26 92 27 100 22 Z" fill="#8edb83" stroke="#4f9a4f" stroke-width="1.5"/>`;
  const bud = `<ellipse cx="102" cy="15" rx="5" ry="6" fill="#8edb83" stroke="#4f9a4f" stroke-width="1.5"/>`;
  const flower = (center = "#ffd84d", petal = "#ff9fc4") =>
    `<g transform="translate(103 11)">${[0, 72, 144, 216, 288]
      .map((a) => `<ellipse cx="0" cy="-7" rx="5" ry="7" fill="${petal}" transform="rotate(${a})"/>`)
      .join("")}<circle r="5" fill="${center}"/></g>`;
  switch (stage) {
    case "bebe": return `<path d="M100 36 Q99 28 101 22" stroke="#5aa85a" stroke-width="4" fill="none" stroke-linecap="round"/>${bud.replace('cy="15"', 'cy="21"')}`;
    case "crianca": return stem + leafR;
    case "jovem": return stem + leafR + leafL;
    case "adulto": return stem + leafL + leafR + flower();
    case "idoso": return stem + leafL + leafR + flower("#fff6cf", "#f4f1ff");
    default: return "";
  }
}

function eyes(mood, look, lidColor) {
  const lx = look.x * 5, ly = look.y * 4;
  const open = (rx = 15, ry = 18, pr = 9) => [72, 128].map((cx) => `
    <g class="eye">
      <ellipse cx="${cx}" cy="98" rx="${rx}" ry="${ry}" fill="#fff" stroke="${INK}" stroke-width="3"/>
      <g class="pupil" style="transform:translate(${lx}px,${ly}px)">
        <circle cx="${cx}" cy="101" r="${pr}" fill="${INK}"/>
        <circle cx="${cx + 3}" cy="96" r="${pr * 0.38}" fill="#fff"/>
        <circle cx="${cx - 3}" cy="105" r="${pr * 0.16}" fill="#fff"/>
      </g>
    </g>`).join("");
  const arcs = (up = true) => [72, 128].map((cx) =>
    `<path d="${up ? `M${cx - 12} 102 Q${cx} 88 ${cx + 12} 102` : `M${cx - 12} 96 Q${cx} 108 ${cx + 12} 96`}" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`).join("");
  const lids = [72, 128].map((cx) =>
    `<path d="M${cx - 16} 98 C${cx - 16} 78 ${cx + 16} 78 ${cx + 16} 98 Z" fill="${lidColor}" stroke="${INK}" stroke-width="3"/>`).join("");
  switch (mood) {
    case "dormindo": return arcs(false) + `<g class="zzz"><text x="150" y="60">z</text><text x="162" y="44">z</text><text x="172" y="30">Z</text></g>`;
    case "sereno": case "carinho": return arcs(true);
    case "rindo": return arcs(true);
    case "sonolento": return open(15, 18, 9) + lids;
    case "assustado": return open(17, 21, 5);
    case "triste": return open(14, 17, 9) + `<path d="M58 78 L84 84 M142 78 L116 84" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
    case "bravo": return open(14, 16, 8) + `<path d="M58 80 L86 90 M142 80 L114 90" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
    case "curioso": return open(15, 18, 9) + `<path d="M116 74 Q128 66 140 74" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    case "doente": return open(13, 14, 7) + `<path d="M60 84 L84 88 M140 84 L116 88" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    default: return open();
  }
}

function mouth(mood, eating) {
  if (eating) return `<ellipse class="boca-comendo" cx="100" cy="136" rx="13" ry="12" fill="#7a2d43" stroke="${INK}" stroke-width="3"/><ellipse cx="100" cy="142" rx="7" ry="4" fill="#ff8fa8"/>`;
  switch (mood) {
    case "feliz": case "rindo":
      return `<path d="M82 128 Q100 152 118 128 Z" fill="#7a2d43" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M90 139 Q100 146 110 139 Q100 134 90 139Z" fill="#ff8fa8"/>`;
    case "triste": case "doente":
      return `<path d="M88 140 Q100 130 112 140" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    case "bravo":
      return `<path d="M86 138 Q100 130 114 138" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    case "assustado":
      return `<path d="M86 136 q4 -5 7 0 t7 0 t7 0 t7 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case "curioso":
      return `<ellipse cx="102" cy="134" rx="5" ry="6" fill="#7a2d43" stroke="${INK}" stroke-width="2.5"/>`;
    case "dormindo": case "sonolento":
      return `<ellipse cx="100" cy="134" rx="5" ry="4" fill="#7a2d43" stroke="${INK}" stroke-width="2.5"/>`;
    default:
      return `<path d="M88 130 Q100 142 112 130" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  }
}

function clothes(outfit = {}) {
  const parts = { back: "", corpo: "", olhos: "", cabeca: "" };
  const c = outfit.corpo;
  if (c === "capa") parts.back = `<path d="M44 120 C30 150 26 176 34 186 L166 186 C174 176 170 150 156 120 Z" fill="#e2394f" stroke="#a81f35" stroke-width="3"/>`;
  if (c === "gravata") parts.corpo = `<g transform="translate(100 160)"><path d="M0 0 L-18 -10 L-18 10 Z M0 0 L18 -10 L18 10 Z" fill="#e2394f" stroke="#a81f35" stroke-width="2" stroke-linejoin="round"/><circle r="5" fill="#a81f35"/></g>`;
  if (c === "cachecol") parts.corpo = `<path d="M40 150 Q100 170 160 150 L162 162 Q100 182 38 162 Z" fill="#4fa3f0" stroke="#2e77c2" stroke-width="2.5"/><path d="M128 162 L134 190 L146 188 L142 160 Z" fill="#4fa3f0" stroke="#2e77c2" stroke-width="2.5"/><path d="M50 156 L50 168 M70 162 L70 174 M90 165 L90 177" stroke="#fff" stroke-width="3" opacity=".7"/>`;
  if (c === "babador") parts.corpo = `<path d="M70 148 Q100 158 130 148 Q132 178 100 180 Q68 178 70 148 Z" fill="#fff" stroke="#f291b8" stroke-width="3"/><circle cx="100" cy="166" r="5" fill="#ffd84d"/>`;
  if (c === "colar") parts.corpo = [60, 72, 86, 100, 114, 128, 140].map((x, i) => `<circle cx="${x}" cy="${152 + Math.sin((i / 6) * Math.PI) * 10}" r="5" fill="#fffaf0" stroke="#d6cbb0" stroke-width="1.5"/>`).join("");
  if (c === "listrada") parts.corpo = `<clipPath id="corpoClip"><path d="${BODY}"/></clipPath><g clip-path="url(#corpoClip)"><rect x="0" y="150" width="200" height="40" fill="#ff7b7b"/>${[156, 168, 180].map((y) => `<rect x="0" y="${y}" width="200" height="5" fill="#fff"/>`).join("")}</g>`;

  const o = outfit.olhos;
  if (o === "redondo") parts.olhos = `<g fill="none" stroke="#6b4b2a" stroke-width="4"><circle cx="72" cy="98" r="22"/><circle cx="128" cy="98" r="22"/><path d="M94 96 Q100 90 106 96"/></g>`;
  if (o === "sol") parts.olhos = `<g stroke="${INK}" stroke-width="3"><path d="M48 86 H96 Q96 118 72 118 Q48 118 48 86Z M104 86 H152 Q152 118 128 118 Q104 118 104 86Z" fill="#1e1e2e"/><path d="M96 90 H104"/></g><path d="M56 92 L66 92" stroke="#fff" stroke-width="3" opacity=".6"/>`;
  if (o === "coracao") parts.olhos = [72, 128].map((x) => `<path transform="translate(${x} 98) scale(1.25)" d="M0 14 C-22 0 -14 -18 0 -8 C14 -18 22 0 0 14Z" fill="#ff5c8a" fill-opacity=".85" stroke="#c22d5c" stroke-width="2.5"/>`).join("") + `<path d="M90 94 H110" stroke="#c22d5c" stroke-width="3"/>`;
  if (o === "estrela") parts.olhos = [72, 128].map((x) => `<path transform="translate(${x} 99)" d="M0 -22 L6 -7 L22 -7 L9 3 L14 19 L0 9 L-14 19 L-9 3 L-22 -7 L-6 -7Z" fill="#ffd84d" fill-opacity=".8" stroke="#d9a400" stroke-width="2.5" stroke-linejoin="round"/>`).join("");

  const h = outfit.cabeca;
  if (h === "laco") parts.cabeca = `<g transform="translate(138 52) rotate(20)"><path d="M0 0 L-22 -12 L-22 12 Z M0 0 L22 -12 L22 12 Z" fill="#ff6fa5" stroke="#d13f7a" stroke-width="2.5" stroke-linejoin="round"/><circle r="6" fill="#d13f7a"/></g>`;
  if (h === "bone") parts.cabeca = `<path d="M50 62 C56 26 144 26 150 62 Z" fill="#4f8cf0" stroke="#2e5fb8" stroke-width="3"/><path d="M140 58 C160 56 178 60 182 66 L146 66Z" fill="#2e5fb8"/><circle cx="100" cy="32" r="5" fill="#2e5fb8"/>`;
  if (h === "gorro") parts.cabeca = `<path d="M48 66 C50 18 150 18 152 66 Z" fill="#ef6b6b" stroke="#c24444" stroke-width="3"/><rect x="44" y="58" width="112" height="16" rx="8" fill="#fff" stroke="#e0dada" stroke-width="2"/><circle cx="100" cy="20" r="11" fill="#fff" stroke="#e0dada" stroke-width="2"/>`;
  if (h === "coroa") parts.cabeca = `<path d="M62 56 L58 22 L80 40 L100 16 L120 40 L142 22 L138 56 Z" fill="#ffd84d" stroke="#d9a400" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="44" r="5" fill="#ff5c8a"/><circle cx="78" cy="48" r="4" fill="#4fa3f0"/><circle cx="122" cy="48" r="4" fill="#5ccf72"/>`;
  if (h === "cartola") parts.cabeca = `<rect x="66" y="4" width="68" height="52" rx="4" fill="#2a2433" stroke="#120f18" stroke-width="3"/><rect x="66" y="38" width="68" height="10" fill="#e2394f"/><ellipse cx="100" cy="58" rx="54" ry="9" fill="#2a2433" stroke="#120f18" stroke-width="3"/>`;
  if (h === "bruxa") parts.cabeca = `<path d="M60 58 L104 -6 Q112 -8 112 2 L140 58 Z" fill="#6c4ad6" stroke="#46309a" stroke-width="3" stroke-linejoin="round"/><rect x="66" y="44" width="68" height="9" fill="#ffd84d"/><ellipse cx="100" cy="60" rx="62" ry="9" fill="#6c4ad6" stroke="#46309a" stroke-width="3"/>`;
  if (h === "flor") parts.cabeca = `<g transform="translate(62 54)">${[0, 72, 144, 216, 288].map((a) => `<ellipse cy="-9" rx="6" ry="9" fill="#fff" stroke="#f3c2d8" stroke-width="1.5" transform="rotate(${a})"/>`).join("")}<circle r="6" fill="#ffd84d"/></g>`;
  if (h === "fones") parts.cabeca = `<path d="M30 110 C26 30 174 30 170 110" stroke="#333" stroke-width="8" fill="none" stroke-linecap="round"/><rect x="18" y="96" width="22" height="34" rx="10" fill="#ff5c8a" stroke="#333" stroke-width="3"/><rect x="160" y="96" width="22" height="34" rx="10" fill="#ff5c8a" stroke="#333" stroke-width="3"/>`;
  return parts;
}

/**
 * opts: { cor, humor, fase, roupa, olhar:{x,y}, comendo, sujeira (0..1), doente, piscando }
 */
export function bubuSVG(opts) {
  const { cor = "pessego", humor = "neutro", fase = "bebe", roupa = {}, olhar = { x: 0, y: 0 }, comendo = false, sujeira = 0, doente = false } = opts;
  if (fase === "ovo") return eggSVG(opts);
  const col = colorOf(cor);
  const cl = clothes(roupa);
  const dirt = sujeira > 0.25
    ? [[60, 150, 9], [140, 140, 7], [116, 168, 10], [80, 62, 6], [150, 110, 6], [46, 120, 7]]
        .slice(0, Math.ceil(sujeira * 6))
        .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.75}" fill="#8a6a4a" opacity="${0.25 + sujeira * 0.4}"/>`).join("") +
      (sujeira > 0.6 ? `<g class="moscas"><circle cx="40" cy="40" r="2.5" fill="#333"/><circle cx="168" cy="70" r="2.5" fill="#333"/></g>` : "")
    : "";
  return `<svg viewBox="-10 -14 220 214" xmlns="http://www.w3.org/2000/svg" style="--bubu-cor:${col.c}" class="bubu-svg humor-${humor}">
    <defs>
      <linearGradient id="arco" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffb3c7"/><stop offset=".3" stop-color="#ffe29a"/><stop offset=".6" stop-color="#b8f0c8"/><stop offset="1" stop-color="#b5c8ff"/>
      </linearGradient>
      <radialGradient id="brilho" cx=".35" cy=".25" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="100" cy="188" rx="64" ry="8" fill="#000" opacity=".12" class="sombra"/>
    ${cl.back}
    <g class="corpo">
      <g class="pes"><ellipse cx="72" cy="180" rx="18" ry="9" fill="${col.d}" stroke="${INK}" stroke-width="3"/><ellipse cx="128" cy="180" rx="18" ry="9" fill="${col.d}" stroke="${INK}" stroke-width="3"/></g>
      <g class="bracos"><ellipse class="braco-e" cx="26" cy="136" rx="10" ry="15" fill="${col.c}" stroke="${INK}" stroke-width="3" transform="rotate(25 26 136)"/><ellipse class="braco-d" cx="174" cy="136" rx="10" ry="15" fill="${col.c}" stroke="${INK}" stroke-width="3" transform="rotate(-25 174 136)"/></g>
      <g class="broto">${sprout(fase)}</g>
      <path d="${BODY}" fill="${col.c}" stroke="${INK}" stroke-width="3.5"/>
      <path d="${BODY}" fill="url(#brilho)"/>
      <ellipse cx="70" cy="62" rx="16" ry="9" fill="#fff" opacity=".45" transform="rotate(-25 70 62)"/>
      ${doente ? `<path d="${BODY}" fill="#9fdc7a" opacity=".35"/>` : ""}
      ${dirt}
      ${cl.corpo}
      <g class="bochechas"><ellipse cx="52" cy="124" rx="12" ry="7" fill="#ff8fab" opacity=".55"/><ellipse cx="148" cy="124" rx="12" ry="7" fill="#ff8fab" opacity=".55"/></g>
      <g class="olhos">${eyes(humor, olhar, col.c)}</g>
      <g class="boca">${mouth(humor, comendo)}</g>
      ${humor === "triste" ? `<path class="lagrima" d="M60 116 q-5 9 0 12 q5 -3 0 -12z" fill="#7cc7ff"/>` : ""}
      ${doente ? `<g class="termometro"><rect x="112" y="134" width="30" height="6" rx="3" fill="#fff" stroke="${INK}" stroke-width="2" transform="rotate(-20 112 134)"/><circle cx="112" cy="137" r="5" fill="#ff5c5c"/></g>` : ""}
      ${fase === "idoso" ? `<path d="M56 74 q8 -6 18 -2 M126 72 q10 -4 18 2" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>` : ""}
      ${cl.olhos}
      ${cl.cabeca}
    </g>
  </svg>`;
}

export function eggSVG({ cor = "pessego", calor = 0 }) {
  const col = colorOf(cor);
  const crack = calor > 0.4 ? `<path d="M60 96 L76 108 L88 94 L102 110 L116 96 L130 108 L142 98" stroke="${INK}" stroke-width="3" fill="none" stroke-linejoin="round"/>` : "";
  const crack2 = calor > 0.75 ? `<path d="M100 40 L94 56 L104 64 L98 76" stroke="${INK}" stroke-width="3" fill="none"/>` : "";
  return `<svg viewBox="-10 -14 220 214" xmlns="http://www.w3.org/2000/svg" class="bubu-svg ovo">
    <ellipse cx="100" cy="188" rx="56" ry="8" fill="#000" opacity=".12"/>
    <g class="ovo-corpo">
      <path d="M100 24 C146 24 166 104 162 140 C158 174 132 186 100 186 C68 186 42 174 38 140 C34 104 54 24 100 24Z" fill="#fffaf2" stroke="${INK}" stroke-width="3.5"/>
      ${[[74, 70, 9], [128, 60, 7], [138, 132, 11], [66, 146, 8], [104, 118, 6], [96, 160, 7]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col.c}" stroke="${col.d}" stroke-width="2"/>`).join("")}
      <ellipse cx="78" cy="56" rx="12" ry="18" fill="#fff" opacity=".7" transform="rotate(20 78 56)"/>
      ${crack}${crack2}
      ${calor > 0.1 ? `<ellipse cx="100" cy="110" rx="70" ry="80" fill="#ffb36b" opacity="${calor * 0.18}"/>` : ""}
    </g>
  </svg>`;
}

/** Ícone pequeno de uma roupa (para o guarda-roupa). */
export function clothIconSVG(item, cor = "pessego") {
  const outfit = { [item.slot]: item.id };
  const vb = item.slot === "cabeca" ? "10 -14 180 120" : item.slot === "olhos" ? "30 60 140 80" : "10 110 180 90";
  const inner = bubuSVG({ cor, humor: "neutro", fase: "jovem", roupa: outfit }).replace(/viewBox="[^"]+"/, `viewBox="${vb}"`);
  return inner;
}
