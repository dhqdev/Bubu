/** Jogo da memória: encontre os pares. */
export const info = { id: "memoria", nome: "Memória", emoji: "🃏", desc: "Vire as cartas e ache os pares com menos jogadas." };

export function start(root, { onEnd }) {
  const EMO = ["🌱", "🍓", "⭐", "🎈", "🐝", "🌈", "🍩", "🐠"];
  const pairs = 6;
  const deck = EMO.slice(0, pairs).flatMap((e) => [e, e]).sort(() => Math.random() - 0.5);
  const wrap = document.createElement("div");
  wrap.className = "memoria";
  wrap.innerHTML = `<div class="memoria-info">Jogadas: <b>0</b></div><div class="memoria-grade">${deck
    .map((e, i) => `<button class="carta" data-i="${i}" aria-label="carta"><span class="frente">${e}</span><span class="verso">?</span></button>`)
    .join("")}</div>`;
  root.appendChild(wrap);
  const info = wrap.querySelector("b");
  let open = [], moves = 0, found = 0, lock = false, alive = true;
  wrap.addEventListener("click", (ev) => {
    const b = ev.target.closest(".carta");
    if (!b || lock || b.classList.contains("virada")) return;
    b.classList.add("virada");
    open.push(b);
    if (open.length < 2) return;
    moves++;
    info.textContent = moves;
    const [a, c] = open;
    if (deck[a.dataset.i] === deck[c.dataset.i]) {
      a.classList.add("ok"); c.classList.add("ok"); open = []; found++;
      if (found === pairs) setTimeout(() => alive && onEnd(Math.max(1, 30 - moves) , Math.max(5, 40 - moves * 2)), 500);
    } else {
      lock = true;
      setTimeout(() => { a.classList.remove("virada"); c.classList.remove("virada"); open = []; lock = false; }, 750);
    }
  });
  return () => { alive = false; };
}
