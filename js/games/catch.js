/** Pega-frutas: arraste o Bubu para pegar as frutas e fugir das pedras. */
export const info = { id: "frutas", nome: "Pega-frutas", emoji: "🍓", desc: "Arraste o Bubu e pegue as frutas. Cuidado com as pedras!" };

export function start(root, { onEnd, bubuImg }) {
  const canvas = document.createElement("canvas");
  canvas.className = "jogo-canvas";
  root.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = root.clientWidth; H = root.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const img = new Image();
  img.src = bubuImg;
  const FRUITS = ["🍎", "🍌", "🍓", "🍉", "🍇", "🍒", "🍑"];
  let x = W / 2, score = 0, lives = 3, items = [], t0 = performance.now(), last = t0, spawn = 0, running = true, flash = 0;
  const size = () => Math.min(90, W * 0.22);

  const move = (e) => { x = e.clientX - root.getBoundingClientRect().left; };
  canvas.addEventListener("pointerdown", move);
  canvas.addEventListener("pointermove", move);

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const el = (now - t0) / 1000;
    spawn -= dt;
    if (spawn <= 0) {
      const rock = Math.random() < Math.min(0.35, 0.12 + el / 120);
      items.push({ x: 20 + Math.random() * (W - 40), y: -30, v: 140 + Math.random() * 80 + el * 6, e: rock ? "🪨" : FRUITS[(Math.random() * FRUITS.length) | 0], rock });
      spawn = Math.max(0.32, 0.9 - el / 60);
    }
    const s = size(), by = H - s * 0.9;
    for (const it of items) it.y += it.v * dt;
    items = items.filter((it) => {
      if (it.y > by - 10 && it.y < by + s * 0.6 && Math.abs(it.x - x) < s * 0.55) {
        if (it.rock) { lives--; flash = 0.3; navigator.vibrate?.(80); } else score++;
        return false;
      }
      return it.y < H + 40;
    });
    flash = Math.max(0, flash - dt);

    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#bfe8ff"); g.addColorStop(1, "#e8fff0");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#8fdc84"; ctx.fillRect(0, H - 24, W, 24);
    ctx.font = "34px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji'";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const it of items) ctx.fillText(it.e, it.x, it.y);
    if (img.complete) ctx.drawImage(img, x - s / 2, by - s * 0.2, s, s);
    if (flash > 0) { ctx.fillStyle = `rgba(255,80,80,${flash})`; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = "#3b2a3a"; ctx.font = "bold 22px Fredoka, system-ui"; ctx.textAlign = "left";
    ctx.fillText(`🍓 ${score}`, 16, 76);
    ctx.textAlign = "right";
    ctx.fillText("❤️".repeat(Math.max(0, lives)), W - 16, 76);
    if (lives <= 0) return finish();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function finish() {
    running = false;
    onEnd(score, Math.ceil(score * 1.5));
  }
  return () => { running = false; window.removeEventListener("resize", resize); };
}
