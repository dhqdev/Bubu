/**
 * VIDA DO BUBU: necessidades, idade e fases (ovo → bebê → criança → jovem → adulto → vovô → fim).
 * Tudo é calculado pelo tempo real, então ele vive mesmo com o app fechado.
 */
import { STAGES, LIFESPAN_H } from "./items.js";
import { clamp } from "./util.js";

// quanto cada necessidade cai por hora (acordado / dormindo)
const AWAKE = { fome: 5, energia: 4, higiene: 3, diversao: 6, afeto: 4 };
const ASLEEP = { fome: 2.5, energia: -18, higiene: 1, diversao: 0, afeto: 1 };
export const MAX_OFFLINE_H = 72;

export function stageOf(save) {
  if (!save.bubu.nascimento) return STAGES[0];
  let st = STAGES[1];
  for (const s of STAGES) if (s.desde >= 0 && save.idadeH >= s.desde) st = s;
  return st;
}

export function nextStage(save) {
  const cur = stageOf(save);
  const i = STAGES.indexOf(cur);
  return STAGES[i + 1] || null;
}

/** Idade em texto amigável (na escala do jogo). */
export function ageText(save) {
  if (!save.bubu.nascimento) return "ainda no ovinho";
  const h = save.idadeH;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 24) return `${Math.floor(h)} h`;
  const d = Math.floor(h / 24);
  return `${d} dia${d > 1 ? "s" : ""}`;
}

/**
 * Avança a vida dtH horas reais. Devolve eventos: [{tipo, ...}].
 */
export function advance(save, dtH) {
  const events = [];
  if (!save.bubu.nascimento || save.fim) return events;
  const n = save.needs;
  const before = stageOf(save).id;
  const rates = save.dormindo ? ASLEEP : AWAKE;
  const baby = before === "bebe" ? 1.3 : before === "idoso" ? 1.15 : 1;
  const ritmo = save.config.ritmo || 1;
  const h = dtH * ritmo;

  n.fome = clamp(n.fome - rates.fome * baby * h);
  n.energia = clamp(n.energia - rates.energia * h);
  n.higiene = clamp(n.higiene - rates.higiene * h);
  n.diversao = clamp(n.diversao - rates.diversao * h);
  n.afeto = clamp(n.afeto - rates.afeto * h);

  // saúde: cai com descuido, sobe quando tudo está bem
  let dano = 0;
  if (n.fome < 10) dano += 3;
  if (n.higiene < 10) dano += 2;
  if (n.energia < 5) dano += 2;
  if (n.afeto < 5) dano += 1;
  if (dano) n.saude = clamp(n.saude - dano * h);
  else if (n.fome > 40 && n.higiene > 40 && n.energia > 30) n.saude = clamp(n.saude + 2 * h);
  if (stageOf(save).id === "idoso") n.saude = clamp(n.saude - 0.3 * h);

  const wasSick = save.doente;
  save.doente = n.saude < 35;
  if (save.doente && !wasSick) events.push({ tipo: "adoeceu" });
  if (!save.doente && wasSick) events.push({ tipo: "sarou" });

  if (save.dormindo && n.energia >= 100) {
    save.dormindo = false;
    events.push({ tipo: "acordou" });
  }

  save.idadeH += h;
  const after = stageOf(save).id;
  if (after !== before) events.push({ tipo: "cresceu", fase: after });

  if (save.idadeH >= LIFESPAN_H) {
    save.fim = { motivo: "velhice", em: Date.now() };
    events.push({ tipo: "fim", motivo: "velhice" });
  } else if (n.saude <= 0) {
    save.fim = { motivo: "saude", em: Date.now() };
    events.push({ tipo: "fim", motivo: "saude" });
  }
  return events;
}

/** Recupera o tempo em que o app ficou fechado (em pedaços, para a saúde reagir no caminho). */
export function catchUp(save, now = Date.now()) {
  const last = save.ultimoTick || now;
  let dtH = Math.min(MAX_OFFLINE_H, Math.max(0, (now - last) / 3.6e6));
  save.ultimoTick = now;
  const events = [];
  // de luz apagada, ele passa o tempo dormindo
  if (!save.luz && save.bubu.nascimento) save.dormindo = true;
  while (dtH > 0 && !save.fim) {
    const step = Math.min(0.25, dtH);
    events.push(...advance(save, step));
    dtH -= step;
  }
  return events;
}

/** Sentidos para a rede neural a partir das necessidades. */
export function senses(save, extra = {}) {
  const n = save.needs;
  const low = (x, at = 50) => clamp((at - x) / at, 0, 1);
  const ok = n.fome > 50 && n.energia > 40 && n.higiene > 50 && n.afeto > 40 && !save.doente;
  return {
    FOME: low(n.fome),
    CANSACO: low(n.energia, 40),
    SUJEIRA: low(n.higiene, 45),
    TEDIO: low(n.diversao, 60),
    SOLIDAO: low(n.afeto, 50),
    DOENTE: save.doente ? clamp((50 - n.saude) / 40, 0.3, 1) : 0,
    ESCURO: save.luz ? 0 : 1,
    BEM_ESTAR: ok ? 0.8 : 0,
    ...extra,
  };
}

/** A necessidade mais urgente (para pedir ajuda). */
export function worstNeed(save) {
  const n = save.needs;
  const list = [
    ["saude", n.saude, 40], ["fome", n.fome, 35], ["energia", n.energia, 25],
    ["higiene", n.higiene, 30], ["afeto", n.afeto, 35], ["diversao", n.diversao, 35],
  ].filter(([, v, lim]) => v < lim).sort((a, b) => a[1] / a[2] - b[1] / b[2]);
  return list[0]?.[0] || null;
}
