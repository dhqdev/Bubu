/** Pula-nuvem: o Bubu quica nas nuvens. Toque no lado esquerdo/direito (ou incline o celular) para mover. */
export const info = { id: "nuvens", nome: "Pula-nuvem", emoji: "☁️", desc: "Segure o lado da tela para ir pra esquerda ou direita. Suba o mais alto que der!" };

export function start(root, { onEnd, bubuImg }) {
  const canvas = document.createElement("canvas");
  canvas.className = "jogo-canvas";
  root.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = root.clientWidth, H = root.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const img = new Image();
  img.src = bubuImg;

  const S = Math.min(64, W * 0.16);
  const p = { x: W / 2, y: H - 140, vx: 0, vy: -620 };
  let clouds = [], camY = 0, best = 0, dir = 0, tilt = 0, running = true, last = performance.now();
  for (let i = 0; i < 9; i++) clouds.push(newCloud(H - 60 - i * (H / 8)));
  clouds[0].x = W / 2 - 40;

  function newCloud(y) {
    return { x: Math.random() * (W - 90), y, w: 80 + Math.random() * 20, move: Math.random() < 0.2 ? (Math.random() < 0.5 ? -60 : 60) : 0 };
  }
  const down = (e) => { dir = e.clientX - root.getBoundingClientRect().left < W / 2 ? -1 : 1; };
  const up = () => { dir = 0; };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", (e) => e.buttons && down(e));
  window.addEventListener("pointerup", up);
  const orient = (e) => { if (e.gamma != null) tilt = Math.max(-1, Math.min(1, e.gamma / 25)); };
  window.addEventListener("deviceorientation", orient);

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    const steer = dir || (Math.abs(tilt) > 0.1 ? tilt : 0);
    p.vx += (steer * 420 - p.vx) * Math.min(1, dt * 8);
    p.x += p.vx * dt;
    if (p.x < -S / 2) p.x = W + S / 2;
    if (p.x > W + S / 2) p.x = -S / 2;
    p.vy += 1300 * dt;
    const prevY = p.y;
    p.y += p.vy * dt;
    for (const c of clouds) {
      c.x += c.move * dt;
      if (c.x < 0 || c.x + c.w > W) c.move *= -1;
      if (p.vy > 0 && prevY <= c.y && p.y >= c.y && p.x > c.x - S * 0.3 && p.x < c.x + c.w + S * 0.3) {
        p.y = c.y; p.vy = -640;
      }
    }
    const target = p.y - H * 0.45;
    if (target < camY) camY = target;
    best = Math.max(best, Math.round((H - 140 - p.y) / 10));
    clouds = clouds.filter((c) => c.y - camY < H + 40);
    while (clouds.length < 9) {
      const top = Math.min(...clouds.map((c) => c.y));
      clouds.push(newCloud(top - (70 + Math.random() * Math.min(80, 40 + best / 10))));
    }
    if (p.y - camY > H + 60) return finish();

    const g = ctx.createLinearGradient(0, 0, 0, H);
    const k = Math.min(1, best / 1500);
    g.addColorStop(0, `hsl(${205 + k * 60}, 80%, ${80 - k * 45}%)`);
    g.addColorStop(1, `hsl(${195 + k * 40}, 85%, ${92 - k * 40}%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const c of clouds) {
      const y = c.y - camY;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(c.x + c.w / 2, y + 6, c.w / 2, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + c.w * 0.35, y, c.w * 0.22, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + c.w * 0.62, y - 2, c.w * 0.25, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (img.complete) ctx.drawImage(img, p.x - S / 2, p.y - camY - S * 0.95, S, S);
    ctx.fillStyle = k > 0.5 ? "#fff" : "#3b2a3a";
    ctx.font = "bold 22px Fredoka, system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`☁️ ${best} m`, 16, 76);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function finish() {
    running = false;
    cleanup();
    onEnd(best, Math.ceil(best / 25));
  }
  function cleanup() {
    window.removeEventListener("pointerup", up);
    window.removeEventListener("deviceorientation", orient);
  }
  return () => { running = false; cleanup(); };
}
