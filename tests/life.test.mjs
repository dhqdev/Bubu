import { test } from "node:test";
import assert from "node:assert/strict";
import { newSave } from "../js/store.js";
import { advance, catchUp, stageOf, worstNeed, senses } from "../js/life.js";
import * as mind from "../js/mind.js";

function hatched() {
  const s = newSave({ dono: "Ana", bubu: "Bubu", cor: "rosa" });
  s.bubu.nascimento = Date.now();
  return s;
}

test("ovo não envelhece até nascer", () => {
  const s = newSave({ dono: "Ana", bubu: "Bubu", cor: "rosa" });
  advance(s, 10);
  assert.equal(s.idadeH, 0);
  assert.equal(stageOf(s).id, "ovo");
});

test("cresce pelas fases e chega ao fim da vida", () => {
  const s = hatched();
  const fases = new Set();
  let fim = null;
  for (let h = 0; h < 800 && !fim; h += 0.5) {
    s.needs = { fome: 90, energia: 90, higiene: 90, diversao: 90, afeto: 90, saude: 100 };
    for (const e of advance(s, 0.5)) {
      if (e.tipo === "cresceu") fases.add(e.fase);
      if (e.tipo === "fim") fim = e;
    }
  }
  assert.deepEqual([...fases], ["crianca", "jovem", "adulto", "idoso"]);
  assert.equal(fim.motivo, "velhice");
});

test("descuido deixa doente e pede ajuda", () => {
  const s = hatched();
  const evs = [];
  for (let i = 0; i < 40; i++) evs.push(...advance(s, 1));
  assert.ok(s.needs.fome < 10);
  assert.ok(evs.some((e) => e.tipo === "adoeceu"));
  assert.ok(worstNeed(s));
  assert.ok(senses(s).FOME > 0.8);
});

test("tempo fora do app é recuperado (com limite)", () => {
  const s = hatched();
  s.ultimoTick = Date.now() - 10 * 3.6e6;
  catchUp(s);
  assert.ok(s.idadeH > 9.9 && s.idadeH < 10.1, String(s.idadeH));
});

test("perguntas viram memória e ele usa depois", () => {
  const s = hatched();
  const q = mind.QUESTIONS.find((x) => x.id === "cor_favorita");
  const r = mind.answerQuestion(s, q, "azul");
  assert.ok(r.aprendeu);
  assert.equal(s.mente.memorias.cor_favorita, "azul");
  assert.ok(!mind.nextQuestion(s, "bebe") || mind.nextQuestion(s, "bebe").id !== "cor_favorita");
});

test("aprende palavras conversando", () => {
  const s = hatched();
  mind.reply(s, "gato é um bichinho que mia", {});
  const r = mind.reply(s, "o que é gato?", {});
  assert.match(r.fala, /bichinho que mia/);
  const r2 = mind.reply(s, "o que é dinossauro?", {});
  assert.equal(r2.perguntarPalavra, "dinossauro");
  const r3 = mind.reply(s, "um bicho gigante que já foi extinto", { pendingWord: "dinossauro" });
  assert.ok(r3.limparPendente);
  assert.match(mind.reply(s, "o que é dinossauro", {}).fala, /extinto/);
});

test("truque aprendido com 👍", () => {
  const s = hatched();
  for (let i = 0; i < 6; i++) mind.rewardTrick(s, "Pula!", "pular", true);
  assert.equal(mind.knownTrick(s, "pula").id, "pular");
  assert.ok(mind.reply(s, "pula", {}).truque);
});
