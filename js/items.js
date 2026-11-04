/** Catálogo: comidas, remédios, roupas, cores e cômodos. */

export const FOODS = [
  { id: "maca", emoji: "🍎", nome: "Maçã", preco: 5, fome: 12, saude: 2, diversao: 0 },
  { id: "banana", emoji: "🍌", nome: "Banana", preco: 5, fome: 14, saude: 1 },
  { id: "morango", emoji: "🍓", nome: "Morango", preco: 6, fome: 8, saude: 2, diversao: 2 },
  { id: "melancia", emoji: "🍉", nome: "Melancia", preco: 8, fome: 18, saude: 1, diversao: 2 },
  { id: "cenoura", emoji: "🥕", nome: "Cenoura", preco: 4, fome: 10, saude: 3, gosto: -1 },
  { id: "brocolis", emoji: "🥦", nome: "Brócolis", preco: 4, fome: 10, saude: 4, gosto: -2 },
  { id: "pao", emoji: "🍞", nome: "Pão", preco: 6, fome: 18 },
  { id: "queijo", emoji: "🧀", nome: "Queijo", preco: 9, fome: 16 },
  { id: "ovo", emoji: "🍳", nome: "Ovo frito", preco: 10, fome: 22, saude: 1 },
  { id: "pizza", emoji: "🍕", nome: "Pizza", preco: 15, fome: 30, saude: -2, diversao: 4, gosto: 2 },
  { id: "hamburguer", emoji: "🍔", nome: "Hambúrguer", preco: 15, fome: 32, saude: -3, diversao: 3, gosto: 2 },
  { id: "sorvete", emoji: "🍦", nome: "Sorvete", preco: 10, fome: 8, saude: -2, diversao: 8, gosto: 3 },
  { id: "bolo", emoji: "🍰", nome: "Bolo", preco: 14, fome: 16, saude: -2, diversao: 8, gosto: 3 },
  { id: "pirulito", emoji: "🍭", nome: "Pirulito", preco: 6, fome: 3, saude: -2, diversao: 6, gosto: 3 },
  { id: "leite", emoji: "🥛", nome: "Leite", preco: 5, fome: 8, saude: 2, energia: 2 },
  { id: "suco", emoji: "🧃", nome: "Suco", preco: 5, fome: 6, saude: 1, diversao: 2 },
  { id: "pocao", emoji: "⚡", nome: "Energético de fruta", preco: 25, fome: 0, energia: 35 },
  { id: "remedio", emoji: "💊", nome: "Remédio", preco: 30, fome: 0, saude: 35, gosto: -3, remedio: true },
];

/** Roupas: desenhadas em SVG no bubu-svg.js (slot = onde vai). */
export const CLOTHES = [
  { id: "laco", slot: "cabeca", nome: "Lacinho", preco: 20 },
  { id: "bone", slot: "cabeca", nome: "Boné", preco: 30 },
  { id: "gorro", slot: "cabeca", nome: "Gorro", preco: 30 },
  { id: "coroa", slot: "cabeca", nome: "Coroa", preco: 80 },
  { id: "cartola", slot: "cabeca", nome: "Cartola", preco: 60 },
  { id: "bruxa", slot: "cabeca", nome: "Chapéu de bruxa", preco: 60 },
  { id: "flor", slot: "cabeca", nome: "Florzinha", preco: 15 },
  { id: "fones", slot: "cabeca", nome: "Fones", preco: 45 },
  { id: "redondo", slot: "olhos", nome: "Óculos redondo", preco: 25 },
  { id: "sol", slot: "olhos", nome: "Óculos de sol", preco: 35 },
  { id: "coracao", slot: "olhos", nome: "Óculos coração", preco: 40 },
  { id: "estrela", slot: "olhos", nome: "Óculos estrela", preco: 40 },
  { id: "gravata", slot: "corpo", nome: "Gravata borboleta", preco: 25 },
  { id: "cachecol", slot: "corpo", nome: "Cachecol", preco: 30 },
  { id: "babador", slot: "corpo", nome: "Babador", preco: 10 },
  { id: "capa", slot: "corpo", nome: "Capa de herói", preco: 70 },
  { id: "colar", slot: "corpo", nome: "Colar de pérolas", preco: 50 },
  { id: "listrada", slot: "corpo", nome: "Camiseta listrada", preco: 40 },
];

export const COLORS = [
  { id: "pessego", nome: "Pêssego", c: "#ffc9a8", d: "#f2a07c", preco: 0 },
  { id: "lilas", nome: "Lilás", c: "#d9c4ff", d: "#ae92f0", preco: 0 },
  { id: "menta", nome: "Menta", c: "#b8f0d8", d: "#7dd3b0", preco: 0 },
  { id: "ceu", nome: "Céu", c: "#b9e2ff", d: "#7fbff0", preco: 0 },
  { id: "rosa", nome: "Rosinha", c: "#ffc4dc", d: "#f291b8", preco: 0 },
  { id: "banana", nome: "Banana", c: "#fff0a8", d: "#f0cf5e", preco: 0 },
  { id: "nuvem", nome: "Nuvem", c: "#fbfbff", d: "#d6d8ea", preco: 40 },
  { id: "caramelo", nome: "Caramelo", c: "#e7b98a", d: "#c48c58", preco: 40 },
  { id: "galaxia", nome: "Galáxia", c: "#8e7cf0", d: "#5b48c6", preco: 120 },
  { id: "arco", nome: "Arco-íris", c: "url(#arco)", d: "#e79ad0", preco: 200 },
];

export const ROOMS = [
  { id: "sala", nome: "Sala" },
  { id: "cozinha", nome: "Cozinha" },
  { id: "banheiro", nome: "Banheiro" },
  { id: "quarto", nome: "Quarto" },
  { id: "fora", nome: "Lá fora" },
];

/** Ações que dá para ensinar como truque. */
export const TRICKS = [
  { id: "pular", nome: "pular", emoji: "⬆️" },
  { id: "girar", nome: "girar", emoji: "🔄" },
  { id: "dancar", nome: "dançar", emoji: "💃" },
  { id: "deitar", nome: "deitar", emoji: "😴" },
  { id: "acenar", nome: "dar tchau", emoji: "👋" },
  { id: "beijo", nome: "mandar beijo", emoji: "😘" },
];

/** Fases da vida: idade mínima em horas (no ritmo normal). */
export const STAGES = [
  { id: "ovo", nome: "Ovinho", desde: -1, escala: 0.8 },
  { id: "bebe", nome: "Bebê", desde: 0, escala: 0.62 },
  { id: "crianca", nome: "Criança", desde: 24, escala: 0.78 },
  { id: "jovem", nome: "Jovem", desde: 96, escala: 0.9 },
  { id: "adulto", nome: "Adulto", desde: 240, escala: 1 },
  { id: "idoso", nome: "Vovô", desde: 600, escala: 0.96 },
];
export const LIFESPAN_H = 720; // ~30 dias no ritmo normal
