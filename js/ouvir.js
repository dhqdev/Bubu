/**
 * O Bubu te ouvindo (reconhecimento de voz do navegador).
 *
 * O microfone só fica ligado enquanto ele está ouvindo uma frase e SEMPRE desliga sozinho:
 * - quando você termina de falar (o navegador manda "end");
 * - depois de alguns segundos sem ninguém falar (limite de tempo);
 * - quando o app vai para o fundo, a tela apaga ou você troca de aba (visibilitychange/pagehide);
 * - quando você toca no botão de novo.
 * Nunca fica escutando em segundo plano. No iPhone, como app instalado (PWA), o Safari pode
 * não permitir o microfone: nesse caso o botão avisa e o chat por texto continua funcionando.
 */
const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

let atual = null; // { rec, parar }

export function suportado() { return !!SR; }
export function ouvindo() { return !!atual; }

/** Para de ouvir agora e desliga o microfone. */
export function parar() { atual?.parar(true); }

/**
 * Ouve uma frase. Devolve uma função que cancela.
 * cb: { onTexto(texto), onParcial(texto), onFim(motivo), onErro(msg) }
 */
export function ouvir({ onTexto, onParcial, onFim, onErro, maxMs = 12000, silencioMs = 6000 } = {}) {
  if (!SR) { onErro?.("Seu navegador não deixa eu ouvir 😢 (use o Chrome ou o Safari)"); return () => {}; }
  parar();
  let rec;
  try { rec = new SR(); } catch { onErro?.("Microfone indisponível"); return () => {}; }
  rec.lang = "pt-BR";
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let final = "";
  let acabou = false;
  let tSilencio = null;
  const tMax = setTimeout(() => fechar("tempo"), maxMs);
  const zerarSilencio = () => { clearTimeout(tSilencio); tSilencio = setTimeout(() => fechar("silencio"), silencioMs); };
  const aoEsconder = () => { if (document.hidden) fechar("fundo"); };
  const aoSair = () => fechar("fundo");

  function fechar(motivo, abortar = true) {
    if (acabou) return;
    acabou = true;
    clearTimeout(tMax); clearTimeout(tSilencio);
    document.removeEventListener("visibilitychange", aoEsconder);
    window.removeEventListener("pagehide", aoSair);
    try { abortar ? rec.abort() : rec.stop(); } catch { /* já parou */ }
    if (atual?.rec === rec) atual = null;
    if (final.trim()) onTexto?.(final.trim());
    onFim?.(motivo);
  }

  rec.onresult = (e) => {
    zerarSilencio();
    let parcial = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript + " ";
      else parcial += r[0].transcript;
    }
    if (parcial) onParcial?.(final + parcial);
    // terminou a frase: desliga na hora (não espera o "end" do navegador)
    if (e.results[e.results.length - 1].isFinal) fechar("ok", false);
  };
  rec.onerror = (e) => {
    const msg = {
      "not-allowed": "Preciso que você deixe eu usar o microfone 🎤",
      "service-not-allowed": "Aqui o navegador não deixa eu ouvir. Tente pelo Chrome/Safari (fora do app instalado).",
      "no-speech": null,
      "aborted": null,
      "audio-capture": "Não achei nenhum microfone 🎤",
      "network": "Para ouvir preciso de internet 📶",
    }[e.error];
    if (msg) onErro?.(msg);
    fechar("erro");
  };
  rec.onend = () => fechar("fim");

  document.addEventListener("visibilitychange", aoEsconder);
  window.addEventListener("pagehide", aoSair);
  try {
    rec.start();
  } catch {
    onErro?.("Microfone indisponível");
    fechar("erro");
    return () => {};
  }
  zerarSilencio();
  atual = { rec, parar: (abortar) => fechar("parou", abortar) };
  return () => fechar("parou");
}
