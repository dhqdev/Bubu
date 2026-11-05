/** Estoura-bolhas: estoure as bolhas antes que elas fujam. Não toque nas bolhas de espinho! */
export const info = { id: "bolhas", nome: "Estoura-bolhas", emoji: "🫧", desc: "Toque nas bolhas em 40 segundos. Evite as de espinho 🌵!" };

export function start(root, { onEnd }) {
  const area = document.createElement("div");
  area.className = "bolhas-area";
  area.innerHTML = `<div class="bolhas-hud"><span>🫧 <b class="pts">0</b></span><span>⏱️ <b class="tempo">40</b></span></div>`;
  root.appendChild(area);
  const pts = area.querySelector(".pts"), tempo = area.querySelector(".tempo");
  let score = 0, left = 40, alive = true;
  const EMO = ["🍬", "⭐", "💖", "🍭", "🌸", "🍀", ""];

  function spawn() {
    if (!alive) return;
    const b = document.createElement("button");
    const bad = Math.random() < 0.15;
    const size = 54 + Math.random() * 40;
    b.className = "bolha" + (bad ? " ruim" : "");
    b.style.cssText = `width:${size}px;height:${size}px;left:${Math.random() * (area.clientWidth - size)}px;animation-duration:${3 + Math.random() * 3}s`;
    b.textContent = bad ? "🌵" : EMO[(Math.random() * EMO.length) | 0];
    b.addEventListener("pointerdown", () => {
      if (b.classList.contains("pop")) return;
      b.classList.add("pop");
      score = Math.max(0, score + (bad ? -3 : 1));
      if (bad) navigator.vibrate?.(60);
      pts.textContent = score;
      setTimeout(() => b.remove(), 200);
    });
    b.addEventListener("animationend", () => b.remove());
    area.appendChild(b);
    setTimeout(spawn, 350 + Math.random() * 400);
  }
  spawn();
  const timer = setInterval(() => {
    left--;
    tempo.textContent = left;
    if (left <= 0) { clearInterval(timer); alive = false; onEnd(score, Math.ceil(score * 1.2)); }
  }, 1000);
  return () => { alive = false; clearInterval(timer); };
}
