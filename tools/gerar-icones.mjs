// Gera os ícones do app a partir do desenho do Bubu: node tools/gerar-icones.mjs
import { writeFileSync } from "node:fs";
import { bubuSVG } from "../js/bubu-svg.js";
import { chromium } from "playwright";

const inner = bubuSVG({ cor: "marrom", humor: "feliz", fase: "adulto" })
  .replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const icon = (pad, round) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="${round}" fill="#ffe9d6"/>
<circle cx="256" cy="300" r="210" fill="#fff" opacity=".55"/>
<svg x="${pad}" y="${pad}" width="${512 - pad * 2}" height="${512 - pad * 2}" viewBox="-10 -14 220 214">${inner}</svg></svg>`;
writeFileSync("icons/icon.svg", icon(40, 110));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
for (const [name, size, pad, round] of [["icon-192", 192, 40, 110], ["icon-512", 512, 40, 110], ["icon-maskable-512", 512, 96, 0]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${icon(pad, round)}`);
  await page.screenshot({ path: `icons/${name}.png`, omitBackground: true });
}
await browser.close();
console.log("ícones gerados");
