/**
 * MENTE DO BUBU: o que ele pergunta, lembra e responde.
 * - Perguntas: ele pergunta coisas sobre você e sobre o mundo; as respostas viram memória.
 * - Palavras: você ensina "X é Y" e ele passa a saber.
 * - Truques: você diz um comando, ele tenta uma ação; 👍/👎 ensina qual é a certa (aprendizado por reforço).
 */
import { norm, pick } from "./util.js";
import { TRICKS } from "./items.js";

export const QUESTIONS = [
  { id: "cor_favorita", txt: "Qual é a sua cor favorita?", tipo: "memoria", fase: 0 },
  { id: "comida_favorita", txt: "Qual comida você mais gosta?", tipo: "memoria", fase: 0 },
  { id: "musica", txt: "Que música você gosta de ouvir?", tipo: "memoria", fase: 1 },
  { id: "animal_favorito", txt: "Qual é o seu bicho favorito? (tirando eu, né 😝)", tipo: "memoria", fase: 1 },
  { id: "brincadeira", txt: "Do que você gosta de brincar?", tipo: "memoria", fase: 1 },
  { id: "dia_a_dia", txt: "O que você faz durante o dia quando não está comigo?", tipo: "memoria", fase: 2 },
  { id: "melhor_amigo", txt: "Quem é o seu melhor amigo ou amiga?", tipo: "memoria", fase: 2 },
  { id: "cidade", txt: "Em que cidade a gente mora?", tipo: "memoria", fase: 2 },
  { id: "medo", txt: "Do que você tem medo?", tipo: "memoria", fase: 2 },
  { id: "sonho", txt: "Qual é o seu maior sonho?", tipo: "memoria", fase: 3 },
  { id: "filme", txt: "Qual seu filme ou desenho favorito?", tipo: "memoria", fase: 2 },
  { id: "chuva", txt: "O que é chuva?", tipo: "palavra", fase: 0 },
  { id: "estrela", txt: "O que é uma estrela?", tipo: "palavra", fase: 1 },
  { id: "mar", txt: "O que é o mar?", tipo: "palavra", fase: 1 },
  { id: "amizade", txt: "O que é amizade?", tipo: "palavra", fase: 2 },
  { id: "escola", txt: "Pra que serve a escola?", tipo: "palavra", fase: 2 },
  { id: "saudade", txt: "O que é saudade?", tipo: "palavra", fase: 2 },
  { id: "sonhar", txt: "Por que a gente sonha quando dorme?", tipo: "palavra", fase: 3 },
  { id: "amor", txt: "O que é amor?", tipo: "palavra", fase: 3 },
  { id: "tempo", txt: "O que é o tempo?", tipo: "palavra", fase: 4 },
  { id: "ceu", txt: "Por que o céu é azul?", tipo: "palavra", fase: 3 },
  { id: "dia", txt: "Como foi o seu dia hoje?", tipo: "diario", fase: 1 },
];

const STAGE_LEVEL = { ovo: -1, bebe: 0, crianca: 1, jovem: 2, adulto: 3, idoso: 4 };

const NEED_HELP = {
  fome: ["Tô com fominha... 🍎", "Minha barriga tá roncando!", "Me dá comida? 🥺"],
  energia: ["Tô com soninho... 😴", "Me leva pra cama?", "Meus olhinhos tão pesados..."],
  higiene: ["Tô fedidinho... 🛁", "Preciso de um banho!", "Eca, tô sujinho!"],
  afeto: ["Me faz carinho? 🥺", "Tô me sentindo sozinho...", "Você ainda gosta de mim?"],
  diversao: ["Tô entediado... vamos brincar? 🎮", "Bora jogar alguma coisa?", "Que tédio..."],
  saude: ["Não tô me sentindo bem... 🤒", "Acho que tô dodói...", "Preciso de remédio..."],
};
export const NEED_ROOM = { fome: "cozinha", energia: "quarto", higiene: "banheiro", afeto: "sala", diversao: "fora", saude: "cozinha" };

export function helpPhrase(need) {
  return pick(NEED_HELP[need] || ["Me ajuda?"]);
}

/** Próxima pergunta que ele ainda não fez (ou a do diário, uma vez por dia). */
export function nextQuestion(save, stageId) {
  const lvl = STAGE_LEVEL[stageId] ?? 0;
  const done = new Set(save.mente.perguntadas);
  const today = new Date().toDateString();
  const options = QUESTIONS.filter((q) => q.fase <= lvl && (q.tipo === "diario" ? save.mente.ultimoDiario !== today : !done.has(q.id)));
  if (!options.length) return null;
  return pick(options);
}

const POSITIVE = ["bom", "boa", "legal", "otimo", "otima", "feliz", "incrivel", "maravilhos", "divertid", "tranquil", "show", "massa", "top", "demais"];
const NEGATIVE = ["ruim", "triste", "cansad", "pessim", "chato", "chata", "dificil", "horrivel", "estress", "brav", "mal"];

export function feeling(text) {
  const t = norm(text);
  const p = POSITIVE.some((w) => t.includes(w)), n = NEGATIVE.some((w) => t.includes(w));
  return n && !p ? -1 : p && !n ? 1 : 0;
}

/** Guarda a resposta e devolve o que o Bubu fala de volta. */
export function answerQuestion(save, q, answer) {
  const m = save.mente;
  const a = String(answer || "").trim().slice(0, 140);
  if (!a || /^(nao sei|sei la|n sei)$/.test(norm(a))) {
    if (q.tipo !== "diario") m.perguntadas.push(q.id);
    return { fala: pick(["Tudo bem! A gente descobre junto 😊", "Hmm, então é um mistério!", "Ok! Depois eu pergunto de novo."]), aprendeu: false };
  }
  m.inteligencia += q.tipo === "palavra" ? 3 : 2;
  if (q.tipo === "diario") {
    m.ultimoDiario = new Date().toDateString();
    const f = feeling(a);
    return {
      fala: f > 0 ? "Que bom!! Fico feliz quando você tá feliz! 💖" : f < 0 ? "Ah não... vem cá, deixa eu te dar um abraço 🫂" : "Hmm, entendi! Obrigado por me contar.",
      diario: `Seu dia: "${a}"`, aprendeu: true, sentimento: f,
    };
  }
  m.perguntadas.push(q.id);
  if (q.tipo === "palavra") {
    m.palavras[q.id] = { palavra: q.txt.replace(/^(o que é|pra que serve|por que)\s*/i, "").replace(/\?$/, ""), significado: a, pergunta: q.txt };
    return { fala: pick([`Uau! Então ${a.toLowerCase()}... vou lembrar disso!`, "Aaah, agora eu entendi! 🤓", "Que legal! Aprendi uma coisa nova!"]), aprendeu: true };
  }
  m.memorias[q.id] = a;
  const resp = {
    cor_favorita: `${a}! Que cor bonita! Vou lembrar 🎨`,
    comida_favorita: `${a}?! Hmm, deve ser uma delícia! 😋`,
    musica: `${a}! Um dia canta pra mim? 🎵`,
    animal_favorito: `${a}! Que fofo!`,
    brincadeira: `${a}! Parece divertido, me ensina?`,
    dia_a_dia: "Uau, você é muito ocupado! Eu fico aqui te esperando 🥰",
    melhor_amigo: `${a}! Fala pra ${a} que eu mandei um oi!`,
    cidade: `${a}! Nossa casa! 🏠`,
    medo: "Não precisa ter medo, eu tô aqui com você! 💪",
    sonho: "Você vai conseguir! Eu acredito em você ✨",
    filme: `${a}! A gente pode assistir juntos um dia!`,
  }[q.id];
  return { fala: resp || "Obrigado! Vou lembrar!", aprendeu: true };
}

/** Uma frase espontânea usando o que ele já sabe. */
export function memoryPhrase(save) {
  const mem = save.mente.memorias, pal = save.mente.palavras;
  const dono = save.dono.nome;
  const opts = [];
  if (mem.cor_favorita) opts.push(`${dono}, eu lembro que sua cor favorita é ${mem.cor_favorita}!`);
  if (mem.comida_favorita) opts.push(`Hoje eu sonhei com ${mem.comida_favorita}... 🤤`);
  if (mem.musica) opts.push(`🎵 Lá lá lá... tô cantando ${mem.musica}!`);
  if (mem.melhor_amigo) opts.push(`Como tá ${mem.melhor_amigo}?`);
  if (mem.animal_favorito) opts.push(`Será que eu pareço um ${mem.animal_favorito}? 🤔`);
  if (mem.sonho) opts.push(`Ainda penso no seu sonho: ${mem.sonho}. Você consegue!`);
  if (mem.cidade) opts.push(`Eu amo morar em ${mem.cidade}!`);
  for (const w of Object.values(pal)) opts.push(`Sabia que ${w.palavra} é ${w.significado}? Você que me ensinou! 🤓`);
  if (!opts.length) opts.push(`Eu gosto muito de você, ${dono}!`, "O que a gente vai fazer hoje?");
  return pick(opts);
}

// ---------- truques (aprendizado por reforço) ----------

export function chooseTrick(save, command) {
  const key = norm(command);
  const q = save.mente.truques[key] || {};
  const temp = 0.25;
  const vals = TRICKS.map((t) => Math.exp((q[t.id] ?? 0) / temp));
  const total = vals.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < TRICKS.length; i++) if ((r -= vals[i]) <= 0) return TRICKS[i];
  return TRICKS[0];
}

export function rewardTrick(save, command, trickId, good) {
  const key = norm(command);
  const q = (save.mente.truques[key] ||= {});
  const old = q[trickId] ?? 0;
  q[trickId] = +(old + 0.5 * ((good ? 1 : -0.5) - old)).toFixed(3);
  if (good) save.mente.inteligencia += 1;
}

export function knownTrick(save, command) {
  const q = save.mente.truques[norm(command)];
  if (!q) return null;
  let best = null, bv = 0.45;
  for (const [id, v] of Object.entries(q)) if (v > bv) { bv = v; best = id; }
  return best ? TRICKS.find((t) => t.id === best) : null;
}

// ---------- conversa livre ----------

const PRAISE = ["bom menino", "boa menina", "lindo", "linda", "fofo", "fofa", "parabens", "muito bem", "inteligente", "te amo", "amo voce", "gosto de voce", "querido", "querida", "isso ai"];
const SCOLD = ["feio", "feia", "chato", "chata", "para com isso", "nao pode", "bobo", "boba", "malcriado", "que feio"];

/**
 * Interpreta o que você escreveu. Devolve { fala, recompensa, truque, aprenderPalavra }.
 */
export function reply(save, text, ctx) {
  const t = norm(text);
  const m = save.mente;
  const dono = save.dono.nome;
  if (!t) return { fala: "?" };

  if (ctx.pendingWord) {
    m.palavras[norm(ctx.pendingWord)] = { palavra: ctx.pendingWord, significado: text.trim().slice(0, 140) };
    m.inteligencia += 2;
    return { fala: `Entendi! ${ctx.pendingWord} é ${text.trim()}. Anotado na minha cabecinha! 🧠`, recompensa: 0.5, aprendeu: ctx.pendingWord, limparPendente: true };
  }

  const trick = knownTrick(save, t);
  if (trick) return { fala: pick(["Olha só!", "Assim?", "Tcharam!"]), truque: trick };

  if (PRAISE.some((w) => t.includes(w))) return { fala: pick(["Hihi 🥰", "Você é o melhor!", "Eu também te amo!! 💖", "Obrigadoo!"]), recompensa: 1 };
  if (SCOLD.some((w) => t.includes(w))) return { fala: pick(["Desculpa... 🥺", "Tá bom... não faço mais.", "Hmpf!"]), recompensa: -1 };

  if (/^(oi|ola|eai|e ai|oie|bom dia|boa tarde|boa noite)\b/.test(t)) return { fala: `Oiii ${dono}! 👋`, recompensa: 0.3 };
  if (/(qual|como) (e )?(o )?meu nome|quem sou eu/.test(t)) return { fala: `Você é ${dono}! Minha pessoa favorita!` };
  if (/(qual|como) (e )?(o )?seu nome|quem e voce/.test(t)) return { fala: `Eu sou ${save.bubu.nome}! 🌱` };
  if (/(como|ta|esta) (voce )?(ta|esta|vai)|tudo bem/.test(t)) return { fala: ctx.comoEstou };
  if (/voce lembra|o que voce sabe|me conta/.test(t)) return { fala: memoryPhrase(save) };

  const def = t.match(/^(.+?) (e|significa|quer dizer) (.+)$/);
  if (def && def[1].split(" ").length <= 3 && !/^(o que|qual|quem|como|onde)/.test(def[1])) {
    const original = text.trim().match(/^(.+?)\s+(é|e|significa|quer dizer)\s+(.+)$/i);
    const palavra = (original?.[1] || def[1]).replace(/^(o|a|os|as|um|uma)\s+/i, "");
    m.palavras[norm(palavra)] = { palavra, significado: (original?.[3] || def[3]).slice(0, 140) };
    m.inteligencia += 2;
    return { fala: `Aaah! ${palavra} é ${original?.[3] || def[3]}! Aprendi! 🤓`, recompensa: 0.5, aprendeu: palavra };
  }

  const ask = t.match(/^(o que e|o que sao|que e|sabe o que e|voce sabe o que e) (o |a |um |uma )?(.+)$/);
  if (ask) {
    const w = ask[3].trim();
    const known = m.palavras[w] || Object.values(m.palavras).find((p) => norm(p.palavra) === w);
    if (known) return { fala: `Eu sei! ${known.palavra} é ${known.significado}! Você me ensinou 😊` };
    return { fala: `Hmm... não sei o que é ${w}. Me ensina? O que é ${w}?`, perguntarPalavra: w };
  }

  if (/brincar|jogar|jogo/.test(t)) return { fala: "Ebaaa! Vamos lá pra fora jogar! 🎮", irPara: "fora" };
  if (/fome|comer|comida/.test(t)) return { fala: "Comidaa! Vamos pra cozinha! 🍽️", irPara: "cozinha" };
  if (/dormir|sono|cama/.test(t)) return { fala: "Hmm, uma soneca seria bom... 😴", irPara: "quarto" };
  if (/banho/.test(t)) return { fala: "Banho? Tá bom... mas sem água fria! 🛁", irPara: "banheiro" };

  const words = t.split(" ").filter((w) => w.length > 3);
  const unknown = words.find((w) => !m.palavras[w]);
  if (unknown && Math.random() < 0.5) return { fala: `"${unknown}"? Que palavra é essa? Me ensina o que é ${unknown}!`, perguntarPalavra: unknown };
  return { fala: pick(["Hmm! Interessante! 🤔", "Hihi, conta mais!", "Não entendi muito bem... mas gostei de conversar!", "Sério?! 😮", "Eu também acho!"]) };
}

/** Bebês falam "bubês". */
export function babble(text) {
  const syl = ["bu", "ba", "bi", "bubu", "ma", "pu", "nhé"];
  return String(text)
    .split(/\s+/)
    .map((w) => {
      const end = /[?!.]$/.test(w) ? w.slice(-1) : "";
      const n = Math.max(1, Math.min(3, Math.round(w.length / 3)));
      return Array.from({ length: n }, () => pick(syl)).join("") + end;
    })
    .slice(0, 6)
    .join(" ");
}
