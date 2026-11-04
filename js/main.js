/**
 * Bubu: app principal (telas, cômodos, interação e o "loop de vida").
 * Cérebro em brain.js, vida em life.js, mente em mind.js, desenho em bubu-svg.js.
 */
import { $, $$, esc, clamp, pick, mulberry32 } from "./util.js";
import { Brain, dominantEmotion, SENSES, INTER, MOTORS } from "./brain.js";
import { FOODS, CLOTHES, COLORS, ROOMS, TRICKS, STAGES, LIFESPAN_H } from "./items.js";
import { bubuSVG, eggSVG, clothIconSVG, colorOf } from "./bubu-svg.js";
import * as store from "./store.js";
import { advance, catchUp, senses, stageOf, nextStage, ageText, worstNeed } from "./life.js";
import * as mind from "./mind.js";
import * as gCatch from "./games/catch.js";
import * as gMemory from "./games/memory.js";
import * as gBubbles from "./games/bubbles.js";
import * as gJump from "./games/jump.js";

const GAMES = [gCatch, gJump, gBubbles, gMemory];
const NEEDS = [
  { id: "fome", emoji: "🍎", nome: "Fome" },
  { id: "higiene", emoji: "🧼", nome: "Higiene" },
  { id: "energia", emoji: "⚡", nome: "Energia" },
  { id: "diversao", emoji: "🎈", nome: "Diversão" },
  { id: "afeto", emoji: "💗", nome: "Carinho" },
  { id: "saude", emoji: "➕", nome: "Saúde" },
];
const MOOD_OF = {
  FELIZ: "feliz", CURIOSIDADE: "curioso", BRAVO: "bravo", TRISTE: "triste",
  SONOLENTO: "sonolento", ASSUSTADO: "assustado", SERENO: "sereno", neutro: "neutro",
};
const MOOD_TXT = {
  feliz: "feliz 😄", curioso: "curioso 🤔", bravo: "bravinho 😠", triste: "tristinho 😢", sonolento: "com sono 😪",
  assustado: "assustado 😨", sereno: "tranquilo 😌", neutro: "de boa 🙂", dormindo: "dormindo 💤", doente: "dodói 🤒", carinho: "amado 🥰",
};
const POOL_TXT = Object.fromEntries([
  ...Object.entries(SENSES).map(([k, v]) => [k, v[4]]),
  ...INTER.map((i) => [i[0], i[6]]),
]);

// ---------------- estado da sessão ----------------
let save = null;
let brain = null;
let roomIdx = 0;
const S = {
  x: 50, targetX: 50, facing: 1, walking: false,
  mood: "neutro", override: null, overrideUntil: 0, eating: false,
  look: { x: 0, y: 0 }, transient: {}, reward: 0,
  cd: {}, lastSvgKey: "", sheet: null, question: null, pendingWord: null,
  lastLife: Date.now(), lastSave: Date.now(), foodIdx: 0, foam: 0, gameStop: null,
  ball: null, lastTouch: Date.now(), firstQuestionAt: Date.now() + 25000,
};

// ---------------- utilidades de UI ----------------
function show(id) {
  $$(".tela").forEach((t) => t.classList.toggle("oculto", t.id !== id));
}
function toast(msg, ms = 2200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("ver");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("ver"), ms);
}
function now() { return Date.now(); }
function cool(name, ms) {
  if ((S.cd[name] || 0) > now()) return false;
  S.cd[name] = now() + ms;
  return true;
}
function pulse(sense, seconds = 2, level = 1) {
  S.transient[sense] = { until: now() + seconds * 1000, level };
}
function addReward(r) { S.reward += r; }
function persist() {
  if (!save) return;
  save.brain = brain ? brain.toJSON() : save.brain;
  save.ultimoTick = now();
  if (!store.persist(save)) toast("Não consegui salvar 😕 (armazenamento cheio?)");
  S.lastSave = now();
}
function diary(texto) {
  save.diario.unshift({ t: now(), texto });
  save.diario = save.diario.slice(0, 120);
}

// ---------------- voz ----------------
let voices = [];
if ("speechSynthesis" in window) {
  const load = () => (voices = speechSynthesis.getVoices().filter((v) => /pt/i.test(v.lang)));
  load();
  speechSynthesis.onvoiceschanged = load;
}
function speak(text) {
  if (!save?.config.voz || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, ""));
    u.lang = "pt-BR";
    if (voices[0]) u.voice = voices.find((v) => v.lang === "pt-BR") || voices[0];
    const st = stageOf(save).id;
    u.pitch = st === "bebe" ? 2 : st === "idoso" ? 1.1 : 1.6;
    u.rate = st === "idoso" ? 0.9 : 1.08;
    speechSynthesis.speak(u);
  } catch { /* sem voz */ }
}

// ---------------- balão de fala ----------------
function say(text, { acoes = [], ms = 4500, falar = true, forcar = false } = {}) {
  const b = $("#balao");
  // um pedido/pergunta na tela não é atropelado por conversa à toa
  if (S.balloonActions && !acoes.length && !forcar) return;
  S.balloonActions = acoes.length > 0;
  const st = save ? stageOf(save).id : "bebe";
  const baby = st === "bebe";
  const main = baby ? mind.babble(text) : text;
  b.innerHTML = `<div class="balao-txt">${esc(main)}</div>${baby ? `<div class="balao-trad">(${esc(text)})</div>` : ""}${
    acoes.length ? `<div class="balao-acoes">${acoes.map((a, i) => `<button class="btn mini" data-i="${i}">${esc(a.txt)}</button>`).join("")}</div>` : ""
  }`;
  b.classList.remove("oculto");
  b.onclick = (e) => {
    const btn = e.target.closest("button");
    if (btn) { acoes[+btn.dataset.i].fn(); hideBalloon(); }
  };
  clearTimeout(say._t);
  if (!acoes.length) say._t = setTimeout(hideBalloon, ms);
  else say._t = setTimeout(hideBalloon, Math.max(ms, 15000));
  if (falar) speak(main);
  positionBalloon();
}
function hideBalloon() {
  $("#balao").classList.add("oculto");
  S.balloonActions = false;
  S.question = null;
}
function positionBalloon() {
  const b = $("#balao");
  b.style.left = clamp(S.x, 30, 70) + "%";
}

// ---------------- efeitos ----------------
function fx(emoji, n = 5, opts = {}) {
  const layer = $("#fx");
  const r = $("#bubu").getBoundingClientRect(), c = $("#cena").getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = "particula " + (opts.cls || "");
    s.textContent = emoji;
    s.style.left = r.left - c.left + r.width * (0.2 + Math.random() * 0.6) + "px";
    s.style.top = r.top - c.top + r.height * (opts.top ?? 0.3) + Math.random() * 30 + "px";
    s.style.setProperty("--dx", (Math.random() - 0.5) * 120 + "px");
    s.style.animationDelay = i * 0.08 + "s";
    layer.appendChild(s);
    setTimeout(() => s.remove(), 1800);
  }
}
function anim(cls, ms = 900) {
  const el = $("#bubu");
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

// ---------------- tela inicial ----------------
function renderStart() {
  $("#inicio-bubu").innerHTML = bubuSVG({ cor: "pessego", humor: "feliz", fase: "adulto" });
  const list = store.listProfiles();
  $("#perfis").innerHTML = list.length
    ? `<p class="rotulo">Continuar como:</p>` + list
        .sort((a, b) => b.atualizado - a.atualizado)
        .map((p) => `<button class="perfil" data-id="${esc(p.id)}"><span class="perfil-mini">${bubuSVG({ cor: p.cor, humor: "neutro", fase: "jovem" })}</span><span><b>${esc(p.dono)}</b><small>e ${esc(p.bubu)}</small></span><span class="perfil-x" data-del="${esc(p.id)}" title="Apagar">✕</span></button>`)
        .join("")
    : "";
  show("tela-inicio");
}
$("#perfis").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]");
  if (del) {
    e.stopPropagation();
    const p = store.listProfiles().find((x) => x.id === del.dataset.del);
    if (p && confirm(`Apagar ${p.dono} e o ${p.bubu}? Isso não tem volta.`)) {
      store.deleteProfile(p.id);
      renderStart();
    }
    return;
  }
  const b = e.target.closest(".perfil");
  if (b) openProfile(b.dataset.id);
});
$("#btn-novo").addEventListener("click", () => {
  renderSignup();
  show("tela-cadastro");
});

// ---------------- cadastro ----------------
let chosenColor = "pessego";
function renderSignup() {
  $("#cadastro-cores").innerHTML = COLORS.filter((c) => !c.preco)
    .map((c) => `<button type="button" class="cor ${c.id === chosenColor ? "sel" : ""}" data-cor="${c.id}" style="--c:${c.c};--d:${c.d}" aria-label="${c.nome}"></button>`)
    .join("");
}
$("#cadastro-cores").addEventListener("click", (e) => {
  const b = e.target.closest(".cor");
  if (!b) return;
  chosenColor = b.dataset.cor;
  renderSignup();
});
$("#btn-voltar").addEventListener("click", renderStart);
$("#form-cadastro").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const dono = String(f.get("dono") || "").trim();
  if (!dono) return;
  save = store.newSave({ dono, bubu: String(f.get("bubu") || "Bubu").trim() || "Bubu", cor: chosenColor, aniversario: f.get("aniversario") });
  diary(`${dono} ganhou um ovinho de ${save.bubu.nome}.`);
  store.persist(save);
  e.target.reset();
  startGame();
});

function openProfile(id) {
  const s = store.loadSave(id);
  if (!s) { toast("Não achei esse save"); return renderStart(); }
  save = s;
  startGame();
}

// ---------------- jogo ----------------
function startGame() {
  brain = save.brain ? Brain.fromJSON(save.brain) : new Brain(save.bubu.seed, save.bubu.personalidade);
  const evs = catchUp(save);
  roomIdx = save.bubu.nascimento ? 0 : 0;
  S.x = 50; S.targetX = 50;
  show("tela-jogo");
  hideBalloon();
  renderRoom();
  renderHud();
  renderBubu(true);
  handleEvents(evs, true);
  if (save.fim) return showEnd();
  if (!save.bubu.nascimento) {
    setTimeout(() => toast("Toque no ovinho para aquecer! 🥚", 3500), 400);
  } else {
    const away = evs.length || 0;
    setTimeout(() => {
      const w = worstNeed(save);
      if (w) say(`${save.dono.nome}! Que saudade! ${mind.helpPhrase(w)}`);
      else say(pick([`Oi ${save.dono.nome}! Que saudade! 💖`, `Você voltou! 🥳`, "Ebaa, você chegou!"]));
      if (away) pulse("NOVIDADE", 3);
    }, 600);
  }
  checkBirthday();
  persist();
  S.lastLife = now();
  startLoop();
}

function checkBirthday() {
  const a = save.dono.aniversario;
  if (!a) return;
  const d = new Date();
  const [, m, day] = a.split("-").map(Number);
  const key = d.getFullYear() + "";
  if (d.getMonth() + 1 === m && d.getDate() === day && save.parabens !== key) {
    save.parabens = key;
    setTimeout(() => { say(`PARABÉNS, ${save.dono.nome}!!! 🎂🎉 Hoje é seu aniversário!`); fx("🎉", 10); }, 2500);
    save.moedas += 50;
  }
}

// ---------------- HUD ----------------
function renderHud() {
  $("#hud-moedas b").textContent = save.moedas;
  $("#hud-barras").innerHTML = NEEDS.map((n) => {
    const v = Math.round(save.needs[n.id]);
    const cls = v < 20 ? "critico" : v < 40 ? "baixo" : "";
    return `<button class="barra ${cls}" data-need="${n.id}" style="--v:${v}" title="${n.nome}: ${v}%"><span>${n.emoji}</span></button>`;
  }).join("");
}
$("#hud-barras").addEventListener("click", (e) => {
  const b = e.target.closest(".barra");
  if (b) toast(`${NEEDS.find((n) => n.id === b.dataset.need).nome}: ${Math.round(save.needs[b.dataset.need])}%`);
});
$("#hud-moedas").addEventListener("click", () => toast(`Você tem ${save.moedas} moedas. Ganhe mais nos jogos lá fora! 🎮`));

// ---------------- cômodos ----------------
const ROOM_ART = {
  sala: `<div class="parede"></div><div class="janela"><div class="janela-ceu"></div></div><div class="quadro">🌻</div><div class="sofa"></div><div class="tapete"></div><div class="planta">🪴</div><div class="chao"></div>`,
  cozinha: `<div class="parede azulejo"></div><div class="geladeira"></div><div class="armario"></div><div class="fogao"></div><div class="mesa"></div><div class="chao xadrez"></div>`,
  banheiro: `<div class="parede azulejo-azul"></div><div class="espelho"></div><div class="banheira"></div><div class="patinho">🦆</div><div class="chao ladrilho"></div>`,
  quarto: `<div class="parede noite"></div><div class="estrelas-parede">✦ ✧ ✦</div><div class="cama"></div><div class="abajur"><div class="cupula"></div></div><div class="guarda-roupa"></div><div class="chao madeira"></div>`,
  fora: `<div class="ceu"></div><div class="sol-lua"></div><div class="nuvem n1"></div><div class="nuvem n2"></div><div class="morro"></div><div class="arvore">🌳</div><div class="flores">🌷 🌼 🌸</div><div class="borboleta">🦋</div><div class="grama"></div>`,
};

function renderRoom() {
  const room = ROOMS[roomIdx];
  $("#nome-comodo").textContent = room.nome;
  const c = $("#cenario");
  c.className = "cenario " + room.id;
  c.innerHTML = ROOM_ART[room.id];
  $("#cena").dataset.room = room.id;
  if (room.id === "fora") {
    const h = new Date().getHours();
    $("#cena").dataset.periodo = h >= 19 || h < 6 ? "noite" : h >= 17 ? "tarde" : "dia";
  } else delete $("#cena").dataset.periodo;
  updateDark();
  renderActions();
  pulse("NOVIDADE", 2, 0.6);
}
function goRoom(id) {
  const i = ROOMS.findIndex((r) => r.id === id);
  if (i >= 0) { roomIdx = i; renderRoom(); }
}
$("#btn-esq").addEventListener("click", () => { roomIdx = (roomIdx + ROOMS.length - 1) % ROOMS.length; renderRoom(); });
$("#btn-dir").addEventListener("click", () => { roomIdx = (roomIdx + 1) % ROOMS.length; renderRoom(); });

// deslizar para trocar de cômodo
let swipe = null;
$("#cena").addEventListener("pointerdown", (e) => {
  if (e.target.closest("#bubu, #balao, button")) return;
  swipe = { x: e.clientX, y: e.clientY, t: now() };
});
$("#cena").addEventListener("pointerup", (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.abs(dx) > 70 && Math.abs(dy) < 60 && now() - swipe.t < 600) (dx < 0 ? $("#btn-dir") : $("#btn-esq")).click();
  else if (S.ball && Math.abs(dx) < 10) kickBall(e);
  swipe = null;
});

function updateDark() {
  const room = ROOMS[roomIdx].id;
  $("#escuro").classList.toggle("ligado", !save.luz && room === "quarto");
  $("#cena").classList.toggle("luz-apagada", !save.luz);
}

// ---------------- ações por cômodo ----------------
function actionBtn(id, emoji, txt, extra = "") {
  return `<button class="acao ${extra}" data-acao="${id}"><span class="acao-emoji">${emoji}</span><span>${txt}</span></button>`;
}
function renderActions() {
  const room = ROOMS[roomIdx].id;
  const a = $("#acoes");
  if (!save.bubu.nascimento) {
    a.innerHTML = actionBtn("aquecer", "🔥", "Aquecer") + actionBtn("menu", "☰", "Menu");
    return;
  }
  if (room === "sala") a.innerHTML = actionBtn("conversar", "💬", "Conversar") + actionBtn("ensinar", "🎓", "Ensinar") + actionBtn("sentimentos", "💗", "Como ele está");
  if (room === "cozinha") {
    const owned = FOODS.filter((f) => (save.comidas[f.id] || 0) > 0);
    if (S.foodIdx >= owned.length) S.foodIdx = 0;
    const f = owned[S.foodIdx];
    a.innerHTML = `<button class="acao seta-comida" data-acao="comida-ant">◀</button>
      <div class="prato" id="prato">${f ? `<span class="comida" id="comida" data-id="${f.id}">${f.emoji}</span><small>${esc(f.nome)} ×${save.comidas[f.id]}</small>` : `<small>Geladeira vazia!<br>Compre no mercado</small>`}</div>
      <button class="acao seta-comida" data-acao="comida-prox">▶</button>${actionBtn("mercado", "🛒", "Mercado")}`;
  }
  if (room === "banheiro") a.innerHTML = `<div class="prato"><span class="comida sabao" id="sabao">🧼</span><small>Esfregue nele</small></div>` + actionBtn("chuveiro", "🚿", "Chuveiro") + actionBtn("remedio", "💊", "Remédio");
  if (room === "quarto") a.innerHTML = actionBtn("roupas", "👕", "Guarda-roupa") + actionBtn("luz", save.luz ? "💡" : "🌙", save.luz ? "Apagar luz" : "Acender luz") + actionBtn("cerebro", "🧠", "Cérebro");
  if (room === "fora") a.innerHTML = actionBtn("jogos", "🎮", "Jogos") + actionBtn("bola", "⚽", S.ball ? "Guardar bola" : "Bola") + actionBtn("diario", "📔", "Memórias");
  setupDraggables();
}

$("#acoes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-acao]");
  if (!b) return;
  const id = b.dataset.acao;
  const owned = () => FOODS.filter((f) => (save.comidas[f.id] || 0) > 0);
  switch (id) {
    case "aquecer": return warmEgg();
    case "menu": return openMenu();
    case "conversar": return openChat();
    case "ensinar": return openTeach();
    case "sentimentos": return openFeelings();
    case "comida-ant": S.foodIdx = (S.foodIdx + owned().length - 1) % Math.max(1, owned().length); return renderActions();
    case "comida-prox": S.foodIdx = (S.foodIdx + 1) % Math.max(1, owned().length); return renderActions();
    case "mercado": return openMarket();
    case "chuveiro": return shower();
    case "remedio": return giveMedicine();
    case "roupas": return openWardrobe();
    case "luz": return toggleLight();
    case "cerebro": return openBrain();
    case "jogos": return openGames();
    case "bola": return toggleBall();
    case "diario": return openDiary();
  }
});
$("#btn-menu").addEventListener("click", openMenu);

// ---------------- ovo ----------------
function warmEgg() {
  if (save.bubu.nascimento) return;
  save.bubu.calor = clamp(save.bubu.calor + 0.09, 0, 1);
  anim("balancar", 600);
  fx("🔥", 2, { top: 0.7 });
  navigator.vibrate?.(20);
  renderBubu(true);
  if (save.bubu.calor >= 1) hatch();
}
function hatch() {
  save.bubu.nascimento = now();
  save.idadeH = 0;
  save.ultimoTick = now();
  diary(`${save.bubu.nome} nasceu! 🐣`);
  fx("✨", 12);
  fx("🥚", 3);
  anim("nascer", 1200);
  renderBubu(true);
  renderActions();
  persist();
  setTimeout(() => say(`Oi... você é minha família? Oi ${save.dono.nome}!`, { ms: 6000 }), 900);
  setTimeout(() => toast("Faça carinho deslizando o dedo nele 💗", 3500), 4500);
  S.firstQuestionAt = now() + 40000;
}

// ---------------- desenho do Bubu ----------------
function currentMood() {
  if (S.override && S.overrideUntil > now()) return S.override;
  if (save.dormindo) return "dormindo";
  if (save.doente && S.mood !== "feliz") return "doente";
  return S.mood;
}
function renderBubu(force = false) {
  const st = stageOf(save);
  const humor = currentMood();
  const sujeira = clamp((60 - save.needs.higiene) / 60, 0, 1);
  const key = [save.bubu.cor, humor, st.id, JSON.stringify(save.roupa), S.eating, Math.round(sujeira * 6), save.doente, save.bubu.calor].join("|");
  const el = $("#bubu");
  el.style.setProperty("--escala", st.escala);
  el.style.left = S.x + "%";
  el.classList.toggle("virado", S.facing < 0);
  el.classList.toggle("andando", S.walking);
  el.classList.toggle("dormindo", save.dormindo);
  if (!force && key === S.lastSvgKey) return;
  S.lastSvgKey = key;
  el.innerHTML = st.id === "ovo"
    ? eggSVG({ cor: save.bubu.cor, calor: save.bubu.calor })
    : bubuSVG({ cor: save.bubu.cor, humor, fase: st.id, roupa: save.roupa, olhar: S.look, comendo: S.eating, sujeira, doente: save.doente });
  if (S.foam > 0) el.insertAdjacentHTML("beforeend", `<div class="espuma" style="opacity:${S.foam}"></div>`);
}
function bubuImage() {
  const st = stageOf(save).id === "ovo" ? "bebe" : stageOf(save).id;
  const svg = bubuSVG({ cor: save.bubu.cor, humor: "feliz", fase: st, roupa: save.roupa });
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// olhos seguem o dedo/mouse
window.addEventListener("pointermove", (e) => {
  const el = $("#bubu");
  if (!el || !save) return;
  const r = el.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.45);
  const d = Math.hypot(dx, dy) || 1;
  S.look = { x: (dx / d) * Math.min(1, d / 150) * (S.facing < 0 ? -1 : 1), y: (dy / d) * Math.min(1, d / 150) };
  $$(".pupil", el).forEach((p) => (p.style.transform = `translate(${S.look.x * 5}px,${S.look.y * 4}px)`));
  S.lastTouch = now();
});

// ---------------- toque: cutucar e carinho ----------------
let touch = null;
$("#bubu").addEventListener("pointerdown", (e) => {
  if (!save) return;
  if (!save.bubu.nascimento) return warmEgg();
  touch = { x: e.clientX, y: e.clientY, dist: 0, t: now(), lastX: e.clientX, lastY: e.clientY, petting: false };
  $("#bubu").setPointerCapture?.(e.pointerId);
});
$("#bubu").addEventListener("pointermove", (e) => {
  if (!touch) return;
  touch.dist += Math.hypot(e.clientX - touch.lastX, e.clientY - touch.lastY);
  touch.lastX = e.clientX; touch.lastY = e.clientY;
  if (touch.dist > 90) {
    if (!touch.petting) { touch.petting = true; }
    pet();
    touch.dist = 40;
  }
});
$("#bubu").addEventListener("pointerup", () => {
  if (!touch) return;
  if (!touch.petting && now() - touch.t < 400) poke();
  touch = null;
});
$("#bubu").addEventListener("pointercancel", () => (touch = null));

function pet() {
  if (save.dormindo) { fx("💤", 1); return; }
  save.needs.afeto = clamp(save.needs.afeto + 1.5);
  save.stats.carinhos++;
  pulse("CARINHO", 1.5);
  addReward(0.6);
  S.override = "carinho"; S.overrideUntil = now() + 1500;
  if (Math.random() < 0.35) fx("💗", 1);
  renderBubu();
  if (save.needs.afeto > 99 && cool("cheio-carinho", 20000)) say(pick(["Hihi, tá bom, tá bom! 🥰", "Eu te amo também!", "Que gostosinho!"]));
}
function poke() {
  if (save.dormindo) {
    if (save.needs.energia < 60) {
      say(pick(["Hmmm... me deixa dormir... 😴", "Zzz... ainda não..."]));
      pulse("BRONCA", 1, 0.3);
    } else { save.dormindo = false; say("Bom diaa! ☀️"); }
    renderBubu(true);
    return;
  }
  pulse("CUTUCADA", 1.5);
  save.needs.diversao = clamp(save.needs.diversao + 0.7);
  anim("pulo", 600);
  navigator.vibrate?.(15);
  const eff = brain.gain[brain.pool("CUTUCADA").start];
  if (eff < 0.6 && cool("cutucada-chata", 8000)) say(pick(["Para de me cutucar! 😤", "Ei! Já chega!", "Aiii, de novo não!"]));
  else if (cool("cutucada-fala", 5000)) say(pick(["Hihi!", "Ei! 😆", "Cosquinha!", "Oi?"]), { ms: 1500 });
}

// ---------------- arrastar comida e sabão ----------------
function setupDraggables() {
  const food = $("#comida");
  const soap = $("#sabao");
  if (food) food.addEventListener("pointerdown", (e) => startDrag(e, "comida", food));
  if (soap) soap.addEventListener("pointerdown", (e) => startDrag(e, "sabao", soap));
}
function startDrag(e, kind, src) {
  e.preventDefault();
  const ghost = $("#arrastando");
  ghost.textContent = src.textContent;
  ghost.classList.add("ver");
  const move = (ev) => {
    ghost.style.transform = `translate(${ev.clientX - 30}px, ${ev.clientY - 30}px)`;
    const r = $("#bubu").getBoundingClientRect();
    const over = ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
    if (kind === "comida") {
      if (over !== S.eating) { S.eating = over && !save.dormindo; renderBubu(); }
    } else if (over) scrub();
  };
  const up = (ev) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    ghost.classList.remove("ver");
    const r = $("#bubu").getBoundingClientRect();
    const over = ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
    if (kind === "comida") {
      S.eating = false;
      if (over) feed(src.dataset.id);
      renderBubu();
    }
  };
  move(e);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function likes(foodId) {
  // gosto pessoal: cada Bubu nasce gostando mais de umas comidas que de outras
  const r = mulberry32(save.bubu.seed + foodId.length * 131 + foodId.charCodeAt(0))();
  const f = FOODS.find((x) => x.id === foodId);
  return (f.gosto || 0) + (r - 0.5) * 3;
}
function feed(id) {
  const f = FOODS.find((x) => x.id === id);
  if (!f || !save.comidas[id]) return;
  if (save.dormindo) return say("Zzz...");
  if (save.needs.fome > 97 && !f.remedio && !f.energia) { S.override = "bravo"; S.overrideUntil = now() + 1200; return say(pick(["Tô cheio! 🫃", "Não cabe mais nada!"])); }
  save.comidas[id]--;
  const n = save.needs;
  n.fome = clamp(n.fome + (f.fome || 0));
  n.saude = clamp(n.saude + (f.saude || 0));
  n.diversao = clamp(n.diversao + (f.diversao || 0));
  n.energia = clamp(n.energia + (f.energia || 0));
  save.stats.comidas++;
  pulse("COMIDA", 3);
  const g = likes(id);
  S.eating = true;
  renderBubu();
  anim("mastigar", 900);
  setTimeout(() => { S.eating = false; renderBubu(); }, 900);
  if (g > 1) { addReward(0.5); S.override = "feliz"; S.overrideUntil = now() + 2500; fx("😋", 2); say(pick([`Hmm! ${f.nome} é muito bom!`, "Delíciaaa! 😋", "Quero mais!"]), { ms: 2500 }); }
  else if (g < -1) { S.override = "bravo"; S.overrideUntil = now() + 2000; say(pick([`Eca, ${f.nome.toLowerCase()}... 🤢`, "Blergh! Mas tudo bem..."]), { ms: 2500 }); }
  else if (cool("comer-fala", 6000)) say(pick(["Nham nham!", "Obrigado!", "Hmm!"]), { ms: 1800 });
  renderActions();
  renderHud();
}

function scrub() {
  if (save.dormindo) return;
  save.needs.higiene = clamp(save.needs.higiene + 0.6);
  S.foam = clamp(S.foam + 0.03, 0, 1);
  pulse("BANHO", 1.5);
  if (Math.random() < 0.25) fx("🫧", 1, { cls: "bolha-fx" });
  if (Math.random() < 0.1) renderBubu(true);
  const espuma = $("#bubu .espuma");
  if (espuma) espuma.style.opacity = S.foam;
  else $("#bubu").insertAdjacentHTML("beforeend", `<div class="espuma" style="opacity:${S.foam}"></div>`);
}
function shower() {
  if (save.dormindo) return say("Zzz...");
  $("#cena").classList.add("chuveiro-on");
  pulse("BANHO", 3);
  save.needs.higiene = clamp(save.needs.higiene + (S.foam > 0.4 ? 40 : 15));
  save.stats.banhos++;
  setTimeout(() => {
    $("#cena").classList.remove("chuveiro-on");
    S.foam = 0;
    renderBubu(true);
    fx("✨", 5);
    say(save.needs.higiene > 90 ? pick(["Cheirosinho! ✨", "Que banho bom!"]) : "Ainda tô meio sujinho...", { ms: 2500 });
    renderHud();
  }, 1800);
}
function giveMedicine() {
  if (!save.comidas.remedio) {
    say(save.doente ? "Precisa comprar remédio no mercado... 💊" : "Eu não tô dodói! 💪");
    return;
  }
  feed("remedio");
}

// ---------------- luz / sono ----------------
function toggleLight() {
  save.luz = !save.luz;
  if (!save.luz) {
    if (save.needs.energia < 92) { save.dormindo = true; say("Boa noite... 🌙", { ms: 2000 }); diary(`${save.bubu.nome} foi dormir.`); }
    else say("Mas eu não tô com sono! 😤", { ms: 2500 });
  } else if (save.dormindo) {
    if (save.needs.energia < 50) { pulse("BRONCA", 1.5, 0.4); say("Ahh, a luz! Tava dormindo... 😫"); }
    else say("Bom dia! ☀️");
    save.dormindo = false;
  }
  updateDark();
  renderActions();
  renderBubu(true);
  persist();
}

// ---------------- bola ----------------
function toggleBall() {
  if (S.ball) { S.ball.el.remove(); S.ball = null; renderActions(); return; }
  const el = document.createElement("div");
  el.className = "bola";
  el.textContent = "⚽";
  $("#cena").appendChild(el);
  S.ball = { el, x: 20, y: 0, vx: 0, vy: 0 };
  renderActions();
  toast("Toque na tela para chutar a bola ⚽");
}
function kickBall(e) {
  if (!S.ball) return;
  const r = $("#cena").getBoundingClientRect();
  const tx = ((e.clientX - r.left) / r.width) * 100;
  S.ball.vx = (tx - S.ball.x) * 1.8;
  S.ball.vy = 90;
  pulse("BRINCAR", 3);
}
function ballStep(dt) {
  const b = S.ball;
  if (!b) return;
  b.vy -= 260 * dt;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) > 20 ? -b.vy * 0.55 : 0; b.vx *= 0.9; }
  if (b.x < 4 || b.x > 96) { b.vx *= -0.8; b.x = clamp(b.x, 4, 96); }
  b.vx *= 1 - dt * 0.6;
  // o Bubu corre atrás e chuta
  if (!save.dormindo && Math.abs(b.x - S.x) > 6) S.targetX = b.x;
  if (Math.abs(b.x - S.x) < 7 && b.y < 8 && !save.dormindo && cool("chute", 900)) {
    b.vx = (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 40);
    b.vy = 70 + Math.random() * 60;
    save.needs.diversao = clamp(save.needs.diversao + 2);
    save.needs.energia = clamp(save.needs.energia - 0.5);
    pulse("BRINCAR", 3);
    anim("pulo", 600);
  }
  b.el.style.left = b.x + "%";
  b.el.style.bottom = `calc(var(--chao) + ${b.y * 2}px)`;
  b.el.style.transform = `translateX(-50%) rotate(${b.x * 12}deg)`;
}

// ---------------- sheets (janelas de baixo) ----------------
function openSheet(html, cls = "") {
  const s = $("#sheet");
  s.className = "sheet " + cls;
  s.innerHTML = `<div class="sheet-alca"></div><button class="sheet-fechar" aria-label="fechar">✕</button>${html}`;
  $("#sheet-fundo").classList.remove("oculto");
  S.sheet = cls || "sheet";
  s.querySelector(".sheet-fechar").onclick = closeSheet;
  return s;
}
function closeSheet() {
  $("#sheet").className = "sheet oculto";
  $("#sheet-fundo").classList.add("oculto");
  S.sheet = null;
  clearInterval(S.brainTimer);
}
$("#sheet-fundo").addEventListener("click", closeSheet);

// ---- conversa ----
const chatLog = [];
function openChat(prefill) {
  const s = openSheet(`
    <h2>Conversar com ${esc(save.bubu.nome)}</h2>
    <div class="chat" id="chat"></div>
    <form class="chat-form" id="chat-form">
      <input id="chat-in" autocomplete="off" maxlength="160" placeholder="${S.pendingWord ? `O que é ${esc(S.pendingWord)}?` : "Escreva algo..."}" />
      ${"webkitSpeechRecognition" in window || "SpeechRecognition" in window ? `<button type="button" class="btn mini" id="chat-mic" aria-label="falar">🎤</button>` : ""}
      <button class="btn mini">Enviar</button>
    </form>
    <p class="dica">Dicas: "oi", "o que é chuva?", "gato é um bichinho que mia", "você lembra?", "bom menino!"</p>`, "chat-sheet");
  renderChat();
  const input = $("#chat-in", s);
  if (prefill) input.value = prefill;
  $("#chat-form", s).onsubmit = (e) => {
    e.preventDefault();
    const txt = input.value.trim();
    if (!txt) return;
    input.value = "";
    talk(txt);
    input.placeholder = S.pendingWord ? `O que é ${S.pendingWord}?` : "Escreva algo...";
  };
  const mic = $("#chat-mic", s);
  if (mic) mic.onclick = () => listen((t) => { input.value = t; });
}
function renderChat() {
  const c = $("#chat");
  if (!c) return;
  c.innerHTML = chatLog.slice(-40).map((m) => `<div class="msg ${m.de === "eu" ? "eu" : "dele"}">${esc(m.txt)}${m.trad ? `<small>${esc(m.trad)}</small>` : ""}</div>`).join("") ||
    `<div class="msg dele">${esc(stageOf(save).id === "bebe" ? "bu? 🌱" : "Oi! Fala comigo! 😊")}</div>`;
  c.scrollTop = c.scrollHeight;
}
function talk(txt) {
  chatLog.push({ de: "eu", txt });
  S.lastTouch = now();
  if (save.dormindo) { chatLog.push({ de: "bubu", txt: "Zzz... 💤" }); return renderChat(); }
  const r = mind.reply(save, txt, { pendingWord: S.pendingWord, comoEstou: howAmI() });
  if (r.limparPendente) S.pendingWord = null;
  if (r.perguntarPalavra) S.pendingWord = r.perguntarPalavra;
  if (r.recompensa) {
    addReward(r.recompensa);
    pulse(r.recompensa > 0 ? "ELOGIO" : "BRONCA", 3);
    if (r.recompensa > 0) save.needs.afeto = clamp(save.needs.afeto + 3);
  }
  if (r.aprendeu) { diary(`Aprendeu: ${r.aprendeu}.`); fx("💡", 2); }
  pulse("ELOGIO", 1.5, 0.4);
  save.needs.afeto = clamp(save.needs.afeto + 0.5);
  const baby = stageOf(save).id === "bebe";
  chatLog.push({ de: "bubu", txt: baby ? mind.babble(r.fala) : r.fala, trad: baby ? r.fala : null });
  say(r.fala, { ms: 3500, forcar: true });
  if (r.truque) doTrick(r.truque);
  if (r.irPara) setTimeout(() => { closeSheet(); goRoom(r.irPara); }, 1200);
  renderChat();
}
function listen(cb) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  try {
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.onresult = (e) => cb(e.results[0][0].transcript);
    rec.onerror = () => toast("Não consegui ouvir 🎤");
    rec.start();
    toast("Fale agora... 🎤");
  } catch { toast("Microfone indisponível"); }
}
function howAmI() {
  const w = worstNeed(save);
  if (w) return `Tô ${MOOD_TXT[currentMood()] || "bem"}... ${mind.helpPhrase(w)}`;
  return pick([`Tô ${MOOD_TXT[currentMood()]}! E você?`, "Tô ótimo! Obrigado por perguntar 🥰"]);
}

// ---- perguntas do Bubu ----
function askQuestion() {
  const q = mind.nextQuestion(save, stageOf(save).id);
  if (!q) return false;
  S.question = q;
  save.stats.perguntas++;
  say(q.txt, {
    acoes: [
      { txt: "Responder", fn: () => setTimeout(() => openAnswer(q), 0) },
      { txt: "Agora não", fn: () => { S.question = null; } },
    ],
  });
  return true;
}
function openAnswer(q) {
  const baby = stageOf(save).id === "bebe";
  const s = openSheet(`
    <div class="pergunta-bubu">${bubuSVG({ cor: save.bubu.cor, humor: "curioso", fase: stageOf(save).id, roupa: save.roupa })}</div>
    <h2>${esc(baby ? mind.babble(q.txt) : q.txt)}</h2>${baby ? `<p class="dica">(${esc(q.txt)})</p>` : ""}
    <form id="resp-form" class="chat-form"><input id="resp-in" maxlength="140" placeholder="Sua resposta..." autocomplete="off"/><button class="btn mini">Responder</button></form>
    <button class="btn claro mini" id="nao-sei">Não sei</button>`, "pergunta-sheet");
  const input = $("#resp-in", s);
  setTimeout(() => input.focus(), 200);
  const done = (ans) => {
    const r = mind.answerQuestion(save, q, ans);
    S.question = null;
    closeSheet();
    if (r.aprendeu) {
      addReward(1);
      pulse("ELOGIO", 3);
      save.needs.afeto = clamp(save.needs.afeto + 5);
      save.moedas += 3;
      fx("💡", 3);
      diary(q.tipo === "diario" ? r.diario : `Aprendeu sobre você: ${q.txt} → ${ans}`);
    }
    say(r.fala, { ms: 5000, forcar: true });
    renderHud();
    persist();
  };
  $("#resp-form", s).onsubmit = (e) => { e.preventDefault(); if (input.value.trim()) done(input.value); };
  $("#nao-sei", s).onclick = () => done("");
}

// ---- ensinar ----
function openTeach() {
  const m = save.mente;
  const words = Object.values(m.palavras);
  const tricks = Object.keys(m.truques).map((c) => ({ c, t: mind.knownTrick(save, c) }));
  const s = openSheet(`
    <h2>Ensinar ${esc(save.bubu.nome)} 🎓</h2>
    <div class="cartao-sec">
      <h3>Uma palavra nova</h3>
      <form id="f-palavra" class="grade2">
        <input name="p" placeholder="Palavra (ex: gato)" maxlength="30" required/>
        <input name="s" placeholder="O que é (ex: um bichinho que mia)" maxlength="140" required/>
        <button class="btn mini">Ensinar</button>
      </form>
    </div>
    <div class="cartao-sec">
      <h3>Um truque</h3>
      <p class="dica">Diga um comando. Ele vai tentar algo: use 👍 quando acertar e 👎 quando errar. Com o tempo ele aprende!</p>
      <form id="f-truque" class="chat-form"><input name="c" placeholder="Comando (ex: pula!)" maxlength="30" required/><button class="btn mini">Mandar</button></form>
      <div id="truque-feedback"></div>
    </div>
    <div class="cartao-sec">
      <h3>O que ele já sabe</h3>
      <ul class="lista">${words.map((w) => `<li><b>${esc(w.palavra)}</b>: ${esc(w.significado)}</li>`).join("") || "<li>Nada ainda!</li>"}</ul>
      <ul class="lista">${tricks.map((x) => `<li>"${esc(x.c)}" → ${x.t ? x.t.emoji + " " + x.t.nome : "ainda aprendendo..."}</li>`).join("")}</ul>
    </div>`, "ensinar-sheet");
  $("#f-palavra", s).onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const p = String(f.get("p")).trim(), sig = String(f.get("s")).trim();
    m.palavras[p.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")] = { palavra: p, significado: sig };
    m.inteligencia += 2;
    addReward(0.5); pulse("ELOGIO", 2);
    diary(`Aprendeu: ${p} é ${sig}.`);
    say(`${p} é ${sig}! Entendi! 🤓`);
    persist();
    openTeach();
  };
  $("#f-truque", s).onsubmit = (e) => {
    e.preventDefault();
    const cmd = String(new FormData(e.target).get("c")).trim();
    if (save.dormindo) return say("Zzz...");
    const t = mind.chooseTrick(save, cmd);
    doTrick(t);
    $("#truque-feedback", s).innerHTML = `<p>Ele fez: <b>${t.emoji} ${t.nome}</b>. Era isso?</p>
      <div class="linha"><button class="btn mini" data-ok="1">👍 Isso!</button><button class="btn claro mini" data-ok="0">👎 Não</button></div>`;
    $("#truque-feedback", s).onclick = (ev) => {
      const b = ev.target.closest("[data-ok]");
      if (!b) return;
      const good = b.dataset.ok === "1";
      mind.rewardTrick(save, cmd, t.id, good);
      addReward(good ? 1 : -0.4);
      pulse(good ? "ELOGIO" : "BRONCA", 2, good ? 1 : 0.4);
      say(good ? pick(["Ebaa! Acertei!", "Eu sou muito esperto! 🤓"]) : pick(["Ops... de novo?", "Hmm, não era isso?"]), { ms: 2000 });
      $("#truque-feedback", s).innerHTML = good && mind.knownTrick(save, cmd) ? `<p>✅ Ele já sabe "${esc(cmd)}"! Tente falar no chat.</p>` : "<p>Mande o comando de novo!</p>";
      persist();
    };
  };
}
function doTrick(t) {
  const map = { pular: "pulo", girar: "girar", dancar: "dancar", deitar: "deitar", acenar: "acenar", beijo: "beijo" };
  anim(map[t.id] || "pulo", 1400);
  if (t.id === "beijo") fx("💋", 2);
  if (t.id === "dancar") fx("🎵", 3);
  save.needs.energia = clamp(save.needs.energia - 0.5);
}

// ---- sentimentos ----
function openFeelings() {
  const st = stageOf(save), nx = nextStage(save);
  const mood = currentMood();
  const learned = brain.learnedSummary(6);
  const traits = personalityText();
  const s = openSheet(`
    <h2>Como ${esc(save.bubu.nome)} está</h2>
    <div class="sent-topo">
      <div class="sent-bubu">${bubuSVG({ cor: save.bubu.cor, humor: mood === "dormindo" ? "dormindo" : mood, fase: st.id, roupa: save.roupa })}</div>
      <div>
        <p class="grande-txt">Está ${MOOD_TXT[mood] || mood}</p>
        <p>${esc(st.nome)} · ${ageText(save)} · geração ${save.bubu.geracao}</p>
        ${nx ? `<p class="dica">Vira ${esc(nx.nome)} com ${nx.desde >= 24 ? Math.round(nx.desde / 24) + " dias" : nx.desde + " h"}</p>` : `<p class="dica">Está aproveitando a melhor idade 💛</p>`}
        <p>🧠 Inteligência: <b>${save.mente.inteligencia}</b></p>
      </div>
    </div>
    <div class="necessidades">${NEEDS.map((n) => `<div class="nec"><span>${n.emoji} ${n.nome}</span><div class="nec-barra"><i style="width:${save.needs[n.id]}%"></i></div><b>${Math.round(save.needs[n.id])}</b></div>`).join("")}</div>
    <div class="cartao-sec"><h3>Personalidade</h3><p>${traits}</p></div>
    <div class="cartao-sec"><h3>O que a experiência ensinou</h3>
      <ul class="lista">${learned.map((l) => `<li>${esc(POOL_TXT[l.sentido] || l.sentido)} → ${l.peso > 0 ? "mais" : "menos"} ${esc(POOL_TXT[l.emocao] || l.emocao)}</li>`).join("") || "<li>Ainda descobrindo o mundo... faça carinho e elogie quando ele estiver feliz!</li>"}</ul>
    </div>`, "sent-sheet");
  return s;
}
function personalityText() {
  const p = save.bubu.personalidade || {};
  const t = [];
  if (p.CURIOSO > 1.1) t.push("muito curioso 🔍");
  if (p.BRINCALHAO > 1.1) t.push("brincalhão 🎈");
  if (p.CALMA > 1.1) t.push("tranquilo 😌");
  if (p.MEDO > 1.1) t.push("um pouco medroso 🙈");
  if (p.CARENCIA > 1.1) t.push("grudento 🥺");
  if (p.FRUSTRACAO > 1.1) t.push("esquentadinho 🔥");
  if (p.SONO > 1.1) t.push("dorminhoco 😴");
  if (p.TRISTEZA < 0.85) t.push("otimista ☀️");
  return t.length ? `${esc(save.bubu.nome)} é ${t.join(", ")}.` : `${esc(save.bubu.nome)} é equilibrado. 🌱`;
}

// ---- cérebro (monitor neural) ----
function openBrain() {
  const s = openSheet(`
    <h2>Cérebro de ${esc(save.bubu.nome)} 🧠</h2>
    <p class="dica">${brain.N} neurônios e ${brain.nSynapses} sinapses. Cada bolinha é um grupo de neurônios: quanto mais brilha, mais está disparando agora.</p>
    <canvas id="cerebro" class="cerebro-canvas"></canvas>
    <div id="motores" class="motores"></div>`, "cerebro-sheet");
  const cv = $("#cerebro", s);
  const draw = () => {
    if (S.sheet !== "cerebro-sheet") return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const rates = brain.rates();
    const cols = [brain.senseNames, INTER.map((i) => i[0]), MOTORS.map((m) => m[0])];
    const pos = {};
    cols.forEach((names, ci) => names.forEach((n, i) => (pos[n] = { x: W * (0.12 + ci * 0.38), y: (H * (i + 0.5)) / names.length })));
    for (const [name, p] of Object.entries(pos)) {
      const r = rates[name] || 0;
      const k = Math.min(1, r / 25);
      const isS = brain.senseNames.includes(name), isM = cols[2].includes(name);
      ctx.beginPath();
      ctx.fillStyle = isS ? `rgba(80,180,255,${0.15 + k * 0.85})` : isM ? `rgba(255,110,160,${0.15 + k * 0.85})` : `rgba(140,110,255,${0.15 + k * 0.85})`;
      ctx.arc(p.x, p.y, 5 + k * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4a3a55";
      ctx.font = "10px Fredoka, system-ui";
      ctx.textAlign = isM ? "right" : "left";
      ctx.fillText((POOL_TXT[name] || name.toLowerCase()).slice(0, 18), p.x + (isM ? -14 : 14), p.y + 3);
    }
    const m = brain.motors();
    $("#motores", s).innerHTML = Object.entries(m).map(([k, v]) => `<div class="mot"><span>${k.toLowerCase().replace("_", " ")}</span><i style="width:${Math.min(100, v * 4)}%"></i><b>${v.toFixed(0)} Hz</b></div>`).join("");
  };
  draw();
  S.brainTimer = setInterval(draw, 400);
}

// ---- mercado ----
function openMarket() {
  const s = openSheet(`
    <h2>Mercado 🛒 <small class="moedas-inline">🪙 ${save.moedas}</small></h2>
    <div class="grade-itens">${FOODS.map((f) => `<button class="item" data-id="${f.id}"><span class="item-emoji">${f.emoji}</span><span>${esc(f.nome)}</span><small>🪙 ${f.preco} · tem ${save.comidas[f.id] || 0}</small></button>`).join("")}</div>`, "mercado-sheet");
  s.querySelector(".grade-itens").onclick = (e) => {
    const b = e.target.closest(".item");
    if (!b) return;
    const f = FOODS.find((x) => x.id === b.dataset.id);
    if (save.moedas < f.preco) return toast("Moedas insuficientes! Jogue lá fora para ganhar 🎮");
    save.moedas -= f.preco;
    save.comidas[f.id] = (save.comidas[f.id] || 0) + 1;
    renderHud(); renderActions();
    openMarket();
    toast(`Comprou ${f.emoji} ${f.nome}`);
  };
}

// ---- guarda-roupa ----
let wardrobeTab = "cabeca";
function openWardrobe() {
  const tabs = [["cabeca", "🎩 Cabeça"], ["olhos", "👓 Olhos"], ["corpo", "🧣 Corpo"], ["cor", "🎨 Cor"]];
  const items = wardrobeTab === "cor"
    ? COLORS.map((c) => {
        const has = save.cores.includes(c.id);
        return `<button class="item ${save.bubu.cor === c.id ? "sel" : ""}" data-cor="${c.id}"><span class="item-cor" style="background:${c.c.startsWith("url") ? "linear-gradient(135deg,#ffb3c7,#ffe29a,#b8f0c8,#b5c8ff)" : c.c}"></span><span>${esc(c.nome)}</span><small>${has ? (save.bubu.cor === c.id ? "usando" : "tocar p/ usar") : "🪙 " + c.preco}</small></button>`;
      }).join("")
    : CLOTHES.filter((c) => c.slot === wardrobeTab).map((c) => {
        const has = save.roupas.includes(c.id);
        const on = save.roupa[c.slot] === c.id;
        return `<button class="item ${on ? "sel" : ""}" data-roupa="${c.id}"><span class="item-svg">${clothIconSVG(c, save.bubu.cor)}</span><span>${esc(c.nome)}</span><small>${has ? (on ? "vestindo" : "tocar p/ vestir") : "🪙 " + c.preco}</small></button>`;
      }).join("");
  const s = openSheet(`
    <h2>Guarda-roupa 👕 <small class="moedas-inline">🪙 ${save.moedas}</small></h2>
    <div class="guarda-preview">${bubuSVG({ cor: save.bubu.cor, humor: "feliz", fase: stageOf(save).id === "ovo" ? "bebe" : stageOf(save).id, roupa: save.roupa })}</div>
    <div class="abas">${tabs.map(([id, t]) => `<button class="aba ${id === wardrobeTab ? "sel" : ""}" data-aba="${id}">${t}</button>`).join("")}</div>
    <div class="grade-itens">${items}</div>
    ${wardrobeTab !== "cor" && save.roupa[wardrobeTab] ? `<button class="btn claro mini" id="tirar">Tirar ${wardrobeTab === "cabeca" ? "chapéu" : wardrobeTab === "olhos" ? "óculos" : "roupa"}</button>` : ""}`, "roupas-sheet");
  s.onclick = (e) => {
    const aba = e.target.closest("[data-aba]");
    if (aba) { wardrobeTab = aba.dataset.aba; return openWardrobe(); }
    if (e.target.closest("#tirar")) { delete save.roupa[wardrobeTab]; afterDress(); return; }
    const r = e.target.closest("[data-roupa]");
    if (r) {
      const c = CLOTHES.find((x) => x.id === r.dataset.roupa);
      if (!save.roupas.includes(c.id)) {
        if (save.moedas < c.preco) return toast("Moedas insuficientes! 🎮");
        save.moedas -= c.preco; save.roupas.push(c.id); toast(`Comprou ${c.nome}!`);
      }
      if (save.roupa[c.slot] === c.id) delete save.roupa[c.slot]; else save.roupa[c.slot] = c.id;
      return afterDress(true);
    }
    const k = e.target.closest("[data-cor]");
    if (k) {
      const c = COLORS.find((x) => x.id === k.dataset.cor);
      if (!save.cores.includes(c.id)) {
        if (save.moedas < c.preco) return toast("Moedas insuficientes! 🎮");
        save.moedas -= c.preco; save.cores.push(c.id);
      }
      save.bubu.cor = c.id;
      afterDress(true);
    }
  };
}
function afterDress(happy) {
  renderBubu(true); renderHud(); openWardrobe(); persist();
  if (happy && cool("roupa-fala", 4000)) { pulse("NOVIDADE", 2); say(pick(["Fiquei lindo? 😍", "Que estiloso!", "Amei!!"]), { ms: 2000 }); }
}

// ---- jogos ----
function openGames() {
  const rec = save.stats.recorde || {};
  const s = openSheet(`
    <h2>Jogos 🎮</h2>
    <p class="dica">Jogar diverte o ${esc(save.bubu.nome)} e dá moedas. Mas cansa um pouquinho!</p>
    <div class="lista-jogos">${GAMES.map((g) => `<button class="jogo-card" data-g="${g.info.id}"><span class="item-emoji">${g.info.emoji}</span><span><b>${g.info.nome}</b><small>${g.info.desc}</small><small>Recorde: ${rec[g.info.id] || 0}</small></span></button>`).join("")}</div>`, "jogos-sheet");
  s.querySelector(".lista-jogos").onclick = (e) => {
    const b = e.target.closest("[data-g]");
    if (!b) return;
    if (save.dormindo) return toast("Ele está dormindo 💤");
    if (save.needs.energia < 10) return say("Tô cansado demais pra jogar... 😴");
    closeSheet();
    playGame(GAMES.find((g) => g.info.id === b.dataset.g));
  };
}
function playGame(g) {
  const box = $("#jogo");
  box.classList.remove("oculto");
  box.innerHTML = `<button class="jogo-sair">✕ Sair</button><div class="jogo-area"></div>`;
  const area = box.querySelector(".jogo-area");
  pulse("BRINCAR", 999);
  const end = (score, coins) => {
    S.gameStop?.(); S.gameStop = null;
    delete S.transient.BRINCAR;
    pulse("BRINCAR", 5);
    save.moedas += coins;
    save.stats.jogos++;
    const rec = (save.stats.recorde ||= {});
    const novo = score > (rec[g.info.id] || 0);
    if (novo) rec[g.info.id] = score;
    save.needs.diversao = clamp(save.needs.diversao + 18 + Math.min(12, score / 3));
    save.needs.energia = clamp(save.needs.energia - 6);
    save.needs.fome = clamp(save.needs.fome - 3);
    addReward(1);
    box.innerHTML = `<div class="fim-jogo cartao"><h2>${novo ? "Novo recorde! 🏆" : "Fim de jogo!"}</h2><p>Pontos: <b>${score}</b></p><p>Moedas: <b>+${coins}</b> 🪙</p><button class="btn" id="jogo-ok">Voltar</button><button class="btn claro" id="jogo-de-novo">Jogar de novo</button></div>`;
    box.querySelector("#jogo-ok").onclick = () => { box.classList.add("oculto"); box.innerHTML = ""; renderHud(); say(pick(["Que divertido!! 🥳", "De novo, de novo!", "Eu fui bem?"])); persist(); };
    box.querySelector("#jogo-de-novo").onclick = () => { if (save.needs.energia < 10) { box.classList.add("oculto"); say("Cansei... 😴"); } else playGame(g); };
  };
  box.querySelector(".jogo-sair").onclick = () => { S.gameStop?.(); S.gameStop = null; box.classList.add("oculto"); box.innerHTML = ""; delete S.transient.BRINCAR; };
  S.gameStop = g.start(area, { onEnd: end, bubuImg: bubuImage() });
}

// ---- diário / memórias ----
function openDiary() {
  const mem = save.mente.memorias;
  const labels = { cor_favorita: "Sua cor favorita", comida_favorita: "Sua comida favorita", musica: "Música que você gosta", animal_favorito: "Seu bicho favorito", brincadeira: "Brincadeira favorita", dia_a_dia: "Seu dia a dia", melhor_amigo: "Seu melhor amigo(a)", cidade: "Nossa cidade", medo: "Seu medo", sonho: "Seu sonho", filme: "Filme favorito" };
  openSheet(`
    <h2>Memórias 📔</h2>
    <div class="cartao-sec"><h3>O que ${esc(save.bubu.nome)} sabe sobre você</h3>
      <ul class="lista">${Object.entries(mem).map(([k, v]) => `<li><b>${esc(labels[k] || k)}:</b> ${esc(v)}</li>`).join("") || "<li>Ele ainda vai te fazer perguntas!</li>"}</ul></div>
    <div class="cartao-sec"><h3>Diário</h3>
      <ul class="lista diario">${save.diario.slice(0, 50).map((d) => `<li><small>${new Date(d.t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small> ${esc(d.texto)}</li>`).join("")}</ul></div>
    ${save.memorial.length ? `<div class="cartao-sec"><h3>🌟 Mural das estrelas</h3><ul class="lista">${save.memorial.map((m) => `<li><b>${esc(m.nome)}</b> (geração ${m.geracao}) viveu ${esc(m.idade)}, aprendeu ${m.palavras} palavras.</li>`).join("")}</ul></div>` : ""}`, "diario-sheet");
}

// ---- menu ----
function openMenu() {
  const c = save.config;
  const url = location.href.split("#")[0];
  const s = openSheet(`
    <h2>Menu</h2>
    <div class="cartao-sec">
      <p>Jogador: <b>${esc(save.dono.nome)}</b> · Bichinho: <b>${esc(save.bubu.nome)}</b></p>
      <button class="btn claro mini" id="m-trocar">Trocar de jogador</button>
    </div>
    <div class="cartao-sec">
      <h3>Configurações</h3>
      <label class="op"><input type="checkbox" id="m-voz" ${c.voz ? "checked" : ""}/> Voz do ${esc(save.bubu.nome)}</label>
      <label class="op">Ritmo da vida
        <select id="m-ritmo">
          <option value="1" ${c.ritmo == 1 ? "selected" : ""}>Normal (vive ~30 dias)</option>
          <option value="6" ${c.ritmo == 6 ? "selected" : ""}>Rápido (vive ~5 dias)</option>
          <option value="60" ${c.ritmo == 60 ? "selected" : ""}>Teste (1 dia = 24 min)</option>
        </select>
      </label>
    </div>
    <div class="cartao-sec">
      <h3>Abrir no celular 📱</h3>
      <p class="dica">Aponte a câmera do celular para o código. No iPhone (Safari) toque em Compartilhar → "Adicionar à Tela de Início". No Android (Chrome) toque em ⋮ → "Instalar app".</p>
      <div id="qr" class="qr"></div>
      <p class="dica url">${esc(url)}</p>
    </div>
    <div class="cartao-sec">
      <h3>Backup</h3>
      <div class="linha"><button class="btn claro mini" id="m-exportar">Baixar save</button><label class="btn claro mini">Carregar save<input type="file" id="m-importar" accept=".json,application/json" hidden/></label></div>
    </div>
    <p class="dica">Bubu v0.1 · cérebro adaptado do <a href="https://github.com/mille-okws/pestinha" target="_blank" rel="noopener">Pestinha</a></p>`, "menu-sheet");
  $("#m-trocar", s).onclick = () => { persist(); closeSheet(); stopLoop(); save = null; renderStart(); };
  $("#m-voz", s).onchange = (e) => { c.voz = e.target.checked; persist(); };
  $("#m-ritmo", s).onchange = (e) => { c.ritmo = +e.target.value; persist(); toast("Ritmo alterado!"); };
  $("#m-exportar", s).onclick = () => {
    persist();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([store.exportSave(save)], { type: "application/json" }));
    a.download = `bubu-${save.dono.nome}-${save.bubu.nome}.json`;
    a.click();
  };
  $("#m-importar", s).onchange = async (e) => {
    try {
      const data = store.importSave(await e.target.files[0].text());
      store.persist(data);
      save = data;
      closeSheet();
      startGame();
      toast("Save carregado! 🎉");
    } catch (err) { toast("Arquivo inválido 😕"); }
  };
  drawQR($("#qr", s), url);
}
async function drawQR(box, url) {
  try {
    if (!window.qrcode) {
      await new Promise((ok, fail) => {
        const sc = document.createElement("script");
        sc.src = "js/vendor/qrcode.js";
        sc.onload = ok; sc.onerror = fail;
        document.head.appendChild(sc);
      });
    }
    const qr = window.qrcode(0, "M");
    qr.addData(url);
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  } catch {
    box.innerHTML = `<p class="dica">Não consegui gerar o QR agora.</p>`;
  }
}

// ---------------- fim da vida ----------------
function showEnd() {
  stopLoop();
  const b = save.bubu;
  const motivo = save.fim?.motivo === "saude" ? "ficou muito dodói e" : "viveu uma vida longa e feliz e";
  const words = Object.keys(save.mente.palavras).length;
  const box = $("#jogo");
  box.classList.remove("oculto");
  box.innerHTML = `<div class="fim-vida">
    <div class="estrela-grande">🌟</div>
    <h2>${esc(b.nome)} ${motivo} foi morar nas estrelas.</h2>
    <p>Viveu ${ageText(save)}, aprendeu ${words} palavras, ${Object.keys(save.mente.memorias).length} coisas sobre você e ganhou ${save.stats.carinhos} carinhos.</p>
    <p>Antes de ir, ele deixou um ovinho com tudo o que aprendeu com você. 🥚💖</p>
    <button class="btn grande" id="novo-ovo">Cuidar do novo ovinho</button>
  </div>`;
  box.querySelector("#novo-ovo").onclick = () => {
    save.memorial.push({ nome: b.nome, geracao: b.geracao, idade: ageText(save), palavras: words, em: now() });
    const learned = brain.learned.map((r) => r.map((x) => x * 0.5));
    const seed = Math.floor(Math.random() * 2 ** 31);
    const temp = store.randomTemperament(seed);
    for (const k of Object.keys(temp)) temp[k] = +(((b.personalidade?.[k] ?? 1) + temp[k]) / 2).toFixed(2);
    save.bubu = { nome: b.nome, cor: b.cor, nascimento: null, calor: 0, geracao: b.geracao + 1, seed, personalidade: temp };
    save.needs = { fome: 80, energia: 90, higiene: 100, diversao: 70, afeto: 60, saude: 100 };
    save.idadeH = 0; save.fim = null; save.dormindo = false; save.doente = false; save.luz = true;
    save.mente.inteligencia = Math.floor(save.mente.inteligencia / 2);
    save.mente.perguntadas = [];
    brain = new Brain(seed, temp);
    brain.learned = learned; brain._rebuild();
    save.brain = brain.toJSON();
    diary(`${b.nome} deixou um ovinho. Começa a geração ${save.bubu.geracao}.`);
    box.classList.add("oculto"); box.innerHTML = "";
    persist();
    startGame();
  };
}

// ---------------- eventos da vida ----------------
function handleEvents(evs, quiet = false) {
  for (const e of evs) {
    if (e.tipo === "cresceu") {
      const st = STAGES.find((s) => s.id === e.fase);
      diary(`${save.bubu.nome} cresceu! Agora é ${st.nome}.`);
      if (!quiet) { fx("✨", 10); anim("nascer", 1200); say(`Olha, eu cresci! Agora sou ${st.nome.toLowerCase()}! 🌱`); }
      renderBubu(true);
    }
    if (e.tipo === "adoeceu") { diary(`${save.bubu.nome} ficou doente.`); if (!quiet) say("Não tô me sentindo bem... 🤒"); }
    if (e.tipo === "sarou") { diary(`${save.bubu.nome} sarou!`); if (!quiet) say("Tô melhor! Obrigado por cuidar de mim 💖"); }
    if (e.tipo === "acordou") { save.luz = true; updateDark(); renderActions(); if (!quiet) say(pick(["Bom diaaa! ☀️", "Dormi muito bem!"])); diary(`${save.bubu.nome} acordou.`); }
    if (e.tipo === "fim") { diary(`${save.bubu.nome} foi morar nas estrelas.`); }
  }
}

// ---------------- loop: corpo, cérebro e vida ----------------
let loopTimer = null, rafId = null;
function stopLoop() { clearInterval(loopTimer); cancelAnimationFrame(rafId); loopTimer = null; }
function startLoop() {
  stopLoop();
  let last = performance.now();
  loopTimer = setInterval(() => {
    if (!save || document.hidden) return;
    const t = now();
    // vida
    const dtH = (t - S.lastLife) / 3.6e6;
    S.lastLife = t;
    if (save.bubu.nascimento && !save.fim) {
      const evs = advance(save, dtH);
      save.ultimoTick = t;
      handleEvents(evs);
      if (save.fim) { persist(); return showEnd(); }
    }
    if (!save.bubu.nascimento) return;
    // cérebro
    const extra = {};
    for (const [k, v] of Object.entries(S.transient)) {
      if (v.until > t) extra[k] = v.level; else delete S.transient[k];
    }
    if (S.ball) extra.BRINCAR = Math.max(extra.BRINCAR || 0, 0.4);
    // sozinho por um tempo, ele fica entediado e vai procurar o que fazer
    const idle = clamp((t - S.lastTouch) / 60000, 0, 1);
    // de vez em quando algo acontece no ambiente (um barulho, uma borboleta...)
    if (Math.random() < 0.25 / 30) pulse("NOVIDADE", 2, 0.5 + Math.random() * 0.5);
    const sense = senses(save, extra);
    sense.TEDIO = Math.max(sense.TEDIO, idle * 0.6);
    brain.stimulate(sense);
    brain.step(250);
    if (brain.learn(clamp(S.reward, -1, 1), 0.25, 0.03)) S.learnedChanged = true;
    S.reward *= 0.5;
    if (Math.abs(S.reward) < 0.05) S.reward = 0;
    decide(brain.motors());
    renderHud();
    renderBubu();
    if (t - S.lastSave > 15000) persist();
  }, 250);

  const frame = (tt) => {
    const dt = Math.min(0.05, (tt - last) / 1000);
    last = tt;
    if (save && save.bubu.nascimento) {
      const dx = S.targetX - S.x;
      S.walking = Math.abs(dx) > 0.6 && !save.dormindo;
      if (S.walking) {
        S.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 14);
        S.facing = Math.sign(dx);
        $("#bubu").style.left = S.x + "%";
        $("#bubu").classList.add("andando");
        $("#bubu").classList.toggle("virado", S.facing < 0);
        positionBalloon();
      } else $("#bubu").classList.remove("andando");
      ballStep(dt);
    }
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);
}

// decisões a partir dos motores da rede
function decide(m) {
  const emo = dominantEmotion(m, 3);
  const mood = MOOD_OF[emo] || "neutro";
  if (mood !== S.mood) S.mood = mood;
  if (save.dormindo) return;
  const sheetOpen = !!S.sheet || !$("#jogo").classList.contains("oculto");

  if (m.COCHILAR > 7 && save.needs.energia < 30 && cool("cochilo", 60000)) {
    save.dormindo = true;
    say("Vou tirar um cochilo... 😴", { ms: 2000 });
    diary(`${save.bubu.nome} cochilou sozinho.`);
    return;
  }
  if (m.PEDIR_AJUDA > 6 && !sheetOpen) {
    const need = worstNeed(save);
    if (need && cool("ajuda", 40000)) {
      const room = mind.NEED_ROOM[need];
      say(mind.helpPhrase(need), { acoes: ROOMS[roomIdx].id !== room ? [{ txt: "Ajudar 💪", fn: () => goRoom(room) }] : [] });
      anim("pulinho", 600);
      return;
    }
  }
  if (m.PERGUNTAR > 5 && !sheetOpen && !S.question && now() > S.firstQuestionAt && stageOf(save).id !== "ovo" && cool("pergunta", 150000)) {
    if (askQuestion()) return;
  }
  if (m.BRINCAR_SOZINHO > 6 && cool("brincar-sozinho", 12000)) {
    doTrick(pick(TRICKS.filter((t) => ["pular", "girar", "dancar"].includes(t.id))));
    if (Math.random() < 0.4) say(pick(["Wiii! 🎶", "Lá lá lá!", "Olha eu!"]), { ms: 1500 });
    return;
  }
  if (m.PASSEAR > 4 && !S.ball && cool("passear", 3500 + Math.random() * 4000)) {
    S.targetX = clamp(S.x + (Math.random() - 0.5) * 60, 15, 85);
  }
  if ((mood === "feliz" || mood === "sereno") && !sheetOpen && cool("lembranca", 120000) && Math.random() < 0.5) {
    say(mind.memoryPhrase(save));
  }
}

// ---------------- ciclo do app ----------------
document.addEventListener("visibilitychange", () => {
  if (!save) return;
  if (document.hidden) persist();
  else {
    const evs = catchUp(save);
    S.lastLife = now();
    handleEvents(evs, true);
    renderHud(); renderBubu(true);
    if (save.fim) showEnd();
  }
});
window.addEventListener("pagehide", () => save && persist());

// iniciar
function boot() {
  const last = store.lastProfileId();
  if (last && store.loadSave(last)) openProfile(last);
  else renderStart();
}
window.__bubu = { get save() { return save; }, get brain() { return brain; }, S };

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker?.register("sw.js").catch(() => {});
}
boot();
