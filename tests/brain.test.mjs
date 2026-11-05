import { test } from "node:test";
import assert from "node:assert/strict";
import { Brain, dominantEmotion } from "../js/brain.js";

function run(b, levels, seconds) {
  b.stimulate(levels);
  for (let t = 0; t < seconds * 5; t++) b.step(200);
  return b.motors();
}

test("a mesma semente monta a mesma rede", () => {
  const a = new Brain(42), b = new Brain(42);
  assert.equal(a.nSynapses, b.nSynapses);
  assert.ok(a.nSynapses > 3000);
});

test("brincar deixa feliz, solidão deixa triste", () => {
  const b = new Brain(7);
  const happy = run(b, { BRINCAR: 1, CARINHO: 0.6 }, 4);
  assert.ok(happy.FELIZ > happy.TRISTE, JSON.stringify(happy));
  const b2 = new Brain(7);
  const sad = run(b2, { SOLIDAO: 1, TEDIO: 0.3 }, 6);
  assert.ok(sad.TRISTE > sad.FELIZ, JSON.stringify(sad));
});

test("cansaço e escuro levam a cochilar", () => {
  const b = new Brain(3);
  const m = run(b, { CANSACO: 1, ESCURO: 1 }, 6);
  assert.ok(m.COCHILAR > m.PASSEAR, JSON.stringify(m));
  assert.equal(dominantEmotion(m), "SONOLENTO");
});

test("carência faz pedir ajuda", () => {
  const b = new Brain(5);
  const m = run(b, { FOME: 1, SOLIDAO: 1 }, 6);
  assert.ok(m.PEDIR_AJUDA > 4, JSON.stringify(m));
});

test("cutucar demais habitua", () => {
  const b = new Brain(9);
  run(b, { CUTUCADA: 1 }, 20);
  const p = b.pool("CUTUCADA");
  const g = Array.from(b.gain.slice(p.start, p.start + p.n)).reduce((x, y) => x + y) / p.n;
  assert.ok(g < 0.8, `ganho ${g}`);
});

test("aprende com recompensa e salva/carrega", () => {
  const b = new Brain(11);
  b.stimulate({ BANHO: 1 });
  for (let i = 0; i < 50; i++) { b.step(200); b.learn(1, 0.2, 0.2); }
  const s = b.learnedSummary();
  assert.ok(s.length > 0 && s.some((x) => x.sentido === "BANHO" && x.peso > 0));
  const c = Brain.fromJSON(JSON.parse(JSON.stringify(b.toJSON())));
  assert.deepEqual(c.learned, b.learned);
  assert.equal(c.nSynapses, b.nSynapses);
});
