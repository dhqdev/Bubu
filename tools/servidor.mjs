// Servidor local para testar o Bubu no celular (mesma rede Wi-Fi): npm run celular
// Mostra um QR code no terminal: aponte a câmera do celular e o jogo abre no navegador.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 5173);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};

http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT) || file.includes(`${ROOT}/node_modules`) || file.includes("/.git")) throw new Error("fora");
    await stat(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Não encontrado");
  }
}).listen(PORT, "0.0.0.0", async () => {
  const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  const url = `http://${ips[0] || "localhost"}:${PORT}/`;
  console.log(`\n  🌱 Bubu rodando!\n\n  No computador: http://localhost:${PORT}/\n  No celular (mesmo Wi-Fi): ${url}\n`);
  await printQR(url);
  console.log("  Aponte a câmera do celular para o código acima.\n  (Para instalar como app de verdade, use o link HTTPS do GitHub Pages: veja o README.)\n");
});

async function printQR(text) {
  const src = await readFile(join(ROOT, "js/vendor/qrcode.js"), "utf8");
  const qrcode = new Function(`${src}; return qrcode;`)();
  const qr = qrcode(0, "L");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), m = 2;
  const dark = (r, c) => r >= 0 && c >= 0 && r < n && c < n && qr.isDark(r, c);
  let out = "";
  for (let r = -m; r < n + m; r += 2) {
    out += "  ";
    for (let c = -m; c < n + m; c++) {
      const top = dark(r, c), bot = dark(r + 1, c);
      out += top && bot ? " " : top ? "▄" : bot ? "▀" : "█";
    }
    out += "\n";
  }
  console.log(out);
}
