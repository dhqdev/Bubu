/**
 * TELA DO CÉREBRO: mostra cada neurônio e cada ligação do Bubu, ao vivo.
 * - bolinhas = neurônios (azul: sentidos, roxo: emoções/pensamento, rosa: ações); acendem quando disparam
 * - linhas cinzas = sinapses de nascença; douradas = sinapses que ele criou sozinho; azuis = inibição
 * - toque num grupo para ver só as ligações dele; arraste para mover e use +/− para zoom
 */
import { SENSES, INTER, MOTORS } from "./brain.js";

const NOMES = Object.fromEntries([
  ...Object.entries(SENSES).map(([k, v]) => [k, v[4]]),
  ...INTER.map((i) => [i[0], i[6]]),
  ...MOTORS.map((m) => [m[0], m[0].toLowerCase().replace(/_/g, " ")]),
]);

export function openBrainView(root, brain, { nome = "Bubu", onClose } = {}) {
  root.innerHTML = `
    <div class="cv-topo">
      <button class="cv-btn" data-a="sair">✕</button>
      <div class="cv-titulo">Cérebro de ${nome}</div>
      <button class="cv-btn" data-a="menos">−</button><button class="cv-btn" data-a="mais">+</button>
    </div>
    <div class="cv-palco"><canvas class="cv-fixo"></canvas><canvas class="cv-vivo"></canvas><div class="cv-info"></div></div>
    <div class="cv-filtros">
      <label><input type="checkbox" data-f="nasc" checked> nascença</label>
      <label><input type="checkbox" data-f="cresc" checked> criadas por ele</label>
      <label><input type="checkbox" data-f="inib" checked> inibição</label>
    </div>
    <div class="cv-stats"></div>`;
  const palco = root.querySelector(".cv-palco");
  const fixo = root.querySelector(".cv-fixo"), vivo = root.querySelector(".cv-vivo");
  const info = root.querySelector(".cv-info"), statsEl = root.querySelector(".cv-stats");
  const filtros = { nasc: true, cresc: true, inib: true };
  let zoom = 1, pan = { x: 0, y: 0 }, sel = null, W = 0, H = 0, dpr = 1, pos = null, labels = [], alive = true, lastStatic = 0;

  // ---------- layout: três colunas; dentro de cada grupo, os neurônios em espiral ----------
  function layout() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = palco.clientWidth; H = palco.clientHeight;
    for (const c of [fixo, vivo]) { c.width = W * dpr; c.height = H * dpr; }
    pos = new Float32Array(brain.N * 2);
    labels = [];
    const cols = [
      brain.pools.filter((p) => p.group === "sens"),
      brain.pools.filter((p) => p.group === "inter"),
      brain.pools.filter((p) => p.group === "expr" || p.group === "dec"),
    ];
    const xs = [0.13, 0.5, 0.87];
    cols.forEach((pools, ci) => {
      const rows = ci === 1 ? Math.ceil(pools.length / 2) : pools.length;
      pools.forEach((p, i) => {
        const PAD = 22, HH = H - PAD * 2;
        let cx = W * xs[ci], cy = PAD + HH * ((i + 0.5) / rows);
        if (ci === 1) { cx = W * (i % 2 ? 0.6 : 0.4); cy = PAD + HH * ((Math.floor(i / 2) + 0.5) / rows); }
        const rad = Math.min(W * 0.075, (HH / rows) * 0.42);
        for (let k = 0; k < p.n; k++) {
          const ang = k * 2.39996, r = rad * Math.sqrt((k + 0.5) / p.n);
          pos[(p.start + k) * 2] = cx + Math.cos(ang) * r;
          pos[(p.start + k) * 2 + 1] = cy + Math.sin(ang) * r;
        }
        labels.push({ p, x: cx, y: cy, rad, col: ci });
      });
    });
    drawStatic();
  }

  const tx = (x) => (x - W / 2) * zoom + W / 2 + pan.x;
  const ty = (y) => (y - H / 2) * zoom + H / 2 + pan.y;
  const poolIdx = (name) => brain.index[name];

  // ---------- camada fixa: todas as ligações ----------
  function drawStatic() {
    const ctx = fixo.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 0.6;
    const selIdx = sel != null ? sel : -1;
    const show = (i, j) => selIdx < 0 || brain.poolOf[i] === selIdx || brain.poolOf[j] === selIdx;
    const alphaBase = selIdx < 0 ? 0.035 : 0.25;
    // nascença
    if (filtros.nasc || filtros.inib) {
      for (let i = 0; i < brain.N; i++) {
        const o = brain.out[i];
        const inh = brain.inhibitory[i];
        for (let k = 0; k < o.idx.length; k++) {
          const j = o.idx[k], w = o.w[k];
          const neg = w < 0;
          if (neg ? !filtros.inib : !filtros.nasc) continue;
          if (!show(i, j)) continue;
          ctx.strokeStyle = neg || inh ? `rgba(90,150,255,${alphaBase})` : `rgba(200,190,230,${alphaBase})`;
          ctx.beginPath();
          ctx.moveTo(tx(pos[i * 2]), ty(pos[i * 2 + 1]));
          ctx.lineTo(tx(pos[j * 2]), ty(pos[j * 2 + 1]));
          ctx.stroke();
        }
      }
    }
    // criadas por ele
    if (filtros.cresc) {
      ctx.lineWidth = 1;
      for (const [key, g] of brain.grown) {
        const i = Math.floor(key / 65536), j = key % 65536;
        if (!show(i, j)) continue;
        const a = Math.min(0.9, 0.15 + Math.abs(g.w) * 14);
        ctx.strokeStyle = g.w < 0 ? `rgba(90,200,255,${a})` : `rgba(255,200,70,${a})`;
        ctx.beginPath();
        ctx.moveTo(tx(pos[i * 2]), ty(pos[i * 2 + 1]));
        ctx.lineTo(tx(pos[j * 2]), ty(pos[j * 2 + 1]));
        ctx.stroke();
      }
    }
    // nomes
    ctx.font = "11px Fredoka, system-ui";
    for (const l of labels) {
      const idx = poolIdx(l.p.name);
      ctx.fillStyle = sel === idx ? "#ffd84d" : "rgba(255,255,255,.75)";
      ctx.textAlign = l.col === 0 ? "left" : l.col === 2 ? "right" : "center";
      const dx = l.col === 0 ? -l.rad : l.col === 2 ? l.rad : 0;
      ctx.fillText((NOMES[l.p.name] || l.p.name).slice(0, 20), tx(l.x + dx), ty(l.y - l.rad - 4));
    }
    lastStatic = performance.now();
  }

  // ---------- camada viva: disparos ----------
  const glow = new Float32Array(brain.N);
  function frame() {
    if (!alive) return;
    const ctx = vivo.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const spikes = brain.takeSpikes();
    for (let i = 0; i < brain.N; i++) {
      glow[i] = Math.max(glow[i] * 0.82, Math.min(1, spikes[i] / 2));
      const grp = brain.pools[brain.poolOf[i]].group;
      const g = glow[i];
      const base = grp === "sens" ? [80, 180, 255] : grp === "inter" ? (brain.inhibitory[i] ? [90, 150, 255] : [170, 130, 255]) : [255, 120, 170];
      ctx.fillStyle = `rgba(${base[0] + (255 - base[0]) * g},${base[1] + (255 - base[1]) * g},${base[2] + (255 - base[2]) * g},${0.35 + g * 0.65})`;
      const r = (1.6 + g * 2.6) * Math.sqrt(zoom);
      ctx.beginPath();
      ctx.arc(tx(pos[i * 2]), ty(pos[i * 2 + 1]), r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (performance.now() - lastStatic > 4000) drawStatic(); // o cérebro muda: redesenha as ligações
    requestAnimationFrame(frame);
  }

  function stats() {
    if (!alive) return;
    const r = brain.rates();
    const top = Object.entries(r).filter(([k]) => !SENSES[k]).sort((a, b) => b[1] - a[1]).slice(0, 3);
    statsEl.innerHTML = `
      <div><b>${brain.N}</b><span>neurônios</span></div>
      <div><b>${brain.nBase.toLocaleString("pt-BR")}</b><span>sinapses de nascença</span></div>
      <div><b>${brain.grown.size.toLocaleString("pt-BR")}</b><span>criadas por ele</span></div>
      <div><b>${brain.stats.nascidas.toLocaleString("pt-BR")}</b><span>já nasceram</span></div>
      <div><b>${brain.stats.podadas.toLocaleString("pt-BR")}</b><span>já foram podadas</span></div>
      <div class="cv-agora"><span>Agora o mais ativo:</span> ${top.map(([k, v]) => `${NOMES[k] || k} <i>${v.toFixed(0)} Hz</i>`).join(" · ")}</div>`;
    if (sel != null) {
      const p = brain.pools[sel];
      let entra = 0, sai = 0, criadas = 0;
      for (let i = 0; i < brain.N; i++) {
        const o = brain.out[i];
        for (let k = 0; k < o.idx.length; k++) {
          if (brain.poolOf[i] === sel) sai++;
          if (brain.poolOf[o.idx[k]] === sel) entra++;
        }
      }
      for (const key of brain.grown.keys()) if (brain.poolOf[Math.floor(key / 65536)] === sel || brain.poolOf[key % 65536] === sel) criadas++;
      info.innerHTML = `<b>${NOMES[p.name] || p.name}</b><br>${p.n} neurônios · ${(r[p.name] || 0).toFixed(1)} Hz<br>${entra} ligações chegando · ${sai} saindo<br>${criadas} criadas por ele<br><small>toque fora para ver tudo</small>`;
      info.style.display = "block";
    } else info.style.display = "none";
    setTimeout(stats, 700);
  }

  // ---------- toque, arraste e zoom ----------
  let drag = null;
  vivo.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false }; vivo.setPointerCapture(e.pointerId); });
  vivo.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
    if (drag.moved) { pan.x = drag.px + dx; pan.y = drag.py + dy; drawStatic(); }
  });
  vivo.addEventListener("pointerup", (e) => {
    if (drag && !drag.moved) {
      const r = vivo.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      let best = null, bd = 1e9;
      for (const l of labels) {
        const d = Math.hypot(tx(l.x) - x, ty(l.y) - y);
        if (d < l.rad * zoom + 12 && d < bd) { bd = d; best = l; }
      }
      sel = best ? poolIdx(best.p.name) : null;
      drawStatic();
    }
    drag = null;
  });
  vivo.addEventListener("wheel", (e) => { e.preventDefault(); zoom = Math.max(0.6, Math.min(5, zoom * (e.deltaY < 0 ? 1.15 : 0.87))); drawStatic(); }, { passive: false });
  root.querySelector(".cv-topo").addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "sair") close();
    if (a === "mais") { zoom = Math.min(5, zoom * 1.3); drawStatic(); }
    if (a === "menos") { zoom = Math.max(0.6, zoom / 1.3); drawStatic(); }
  });
  root.querySelector(".cv-filtros").addEventListener("change", (e) => {
    const f = e.target.dataset.f;
    if (f) { filtros[f] = e.target.checked; drawStatic(); }
  });
  const onResize = () => layout();
  window.addEventListener("resize", onResize);

  function close() {
    alive = false;
    window.removeEventListener("resize", onResize);
    root.innerHTML = "";
    onClose?.();
  }

  requestAnimationFrame(() => { layout(); frame(); stats(); });
  return close;
}
