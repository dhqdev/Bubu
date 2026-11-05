import { test } from "node:test";
import assert from "node:assert/strict";
import { newSave } from "../js/store.js";
import * as cr from "../js/criatividade.js";

function save() {
  const s = newSave({ dono: "Ana", bubu: "Bubu", cor: "marrom" });
  s.bubu.nascimento = Date.now();
  return s;
}

test("aprende frases e cria pensamentos com as palavras do dono", () => {
  const s = save();
  assert.equal(cr.criar(s, "frase")?.tipo === "frase", false); // ainda não sabe falar
  for (const t of ["eu gosto muito de chocolate quente", "o gato dorme no sofá azul", "eu gosto de ver o mar azul", "o mar é grande e azul"]) cr.aprenderTexto(s, t);
  const c = cr.criar(s, "frase");
  assert.equal(c.tipo, "frase");
  const vocab = new Set("eu gosto muito de chocolate quente o gato dorme no sofá azul ver mar é grande e".split(" "));
  for (const w of c.texto.toLowerCase().replace(/[^\p{L} ]/gu, "").split(" ").filter(Boolean)) assert.ok(vocab.has(w), w);
});

test("inventa misturando palavras ensinadas e desenha com cores conhecidas", () => {
  const s = save();
  s.mente.palavras.gato = { palavra: "gato", significado: "um bichinho que mia" };
  s.mente.palavras.foguete = { palavra: "foguete", significado: "uma nave que voa até a lua" };
  s.mente.memorias.cor_favorita = "azul";
  const inv = cr.criar(s, "invencao");
  assert.match(inv.texto, /gato|foguete/);
  const d = cr.criar(s, "desenho");
  assert.equal(d.desenho.cores[0], "#4f8cf0");
  assert.match(cr.desenhoSVG(d.desenho), /^<svg/);
  assert.ok(cr.saber(s) > 0);
});

test("👍 faz ele criar mais daquele tipo", () => {
  const s = save();
  const c = cr.criar(s, "musica");
  assert.ok(c.notas.length > 0);
  cr.avaliar(s, c.id, true);
  assert.ok(s.mente.gosto.musica > 1);
  assert.equal(cr.avaliar(s, c.id, false), null); // só avalia uma vez
});
