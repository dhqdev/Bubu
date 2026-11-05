# Bubu 🌱

Um bichinho virtual fofinho, no estilo dos jogos de cuidar de pet, só que **com vida própria**: ele tem uma
rede neural de verdade, sente fome, sono, saudade e tédio, anda pela casa sozinho, pede ajuda, faz perguntas
para aprender sobre você e sobre o mundo, cresce do ovinho até a velhice e, no fim, deixa um ovinho com o que aprendeu.

É um **PWA** (site que vira app): abre no navegador do celular e pode ser instalado na tela inicial do iPhone e do Android,
sem loja. Funciona offline depois da primeira visita.

![Telas do Bubu](docs/telas/resumo.png)

## O que já tem

| | |
|---|---|
| **Conta** | Quando o app roda no servidor, você cria uma conta (usuário e senha) e o Bubu fica salvo na nuvem: entra em outro celular e ele está lá. Sem servidor (ou sem internet) o jogo continua salvando no aparelho. |
| **Pré-cadastro** | Seu nome, nome do bichinho, aniversário (ele lembra e dá parabéns) e a cor do ovinho (o padrão é marrom). Dá para ter vários jogadores no mesmo celular. |
| **Jeito dele** | Marrom, fofinho, sem gênero. Os olhos têm vida própria: seguem o seu dedo e, quando você para, olham a bola, para onde ele anda ou ficam passeando conforme o humor. |
| **Fundo** | O botão 🎨 troca o papel de parede de cada cômodo (e o céu lá fora). Alguns são de graça, outros custam moedas. |
| **Ciclo de vida** | Ovo (toque para aquecer) → bebê → criança → jovem → adulto → vovô → fim. O brotinho da cabeça cresce: broto, folhinha, duas folhas, flor. Bebê fala "bubês" (com tradução embaixo). |
| **Cômodos** | Sala, cozinha, banheiro, quarto e lá fora (o céu segue a hora real). Troque com as setas ou deslizando o dedo. |
| **Cuidar** | Arraste comida até a boca, esfregue o sabonete e use o chuveiro, apague a luz para ele dormir, dê remédio quando estiver dodói. Carinho = deslizar o dedo nele. Cutucar = tocar (mas se cutucar demais ele enjoa). |
| **Guarda-roupa** | Chapéus, óculos, roupas e cores, compradas com moedas. |
| **Mini-jogos** | Pega-frutas, Pula-nuvem, Estoura-bolhas e Memória. Dão moedas e diversão (e cansam). |
| **Vida própria** | A rede neural decide quando ele passeia, brinca sozinho, cochila, pede ajuda ou faz uma pergunta. Ele continua vivendo com o app fechado (até 72 h são recuperadas ao voltar). |
| **Aprender** | Ele pergunta coisas ("qual sua cor favorita?", "o que é saudade?", "como foi seu dia?") e lembra depois. Você ensina palavras ("gato é um bichinho que mia") e truques (diz um comando e dá 👍/👎 até ele acertar). |
| **Criações** | Ele cria sozinho a partir do que você ensina: pensamentos e poemas (com as suas palavras), desenhos (com as cores e coisas que conhece), invenções (misturando duas palavras) e musiquinhas. Dê 👍 no que gostar e ele faz mais daquilo. |
| **Cérebro** | No quarto, o botão 🧠 abre a tela do cérebro: todos os neurônios e ligações, piscando ao vivo. Toque num grupo para ver de onde vêm e para onde vão as ligações dele; arraste e use +/− para dar zoom. |
| **Voz** | Ele fala em voz alta (pode desligar no menu). No chat dá para falar pelo microfone, se o navegador permitir. |

## Instalar na sua VPS (com conta e banco)

Uma linha, no servidor (Ubuntu/Debian, amd64 ou **arm64**, como a Oracle Ampere):

```bash
curl -fsSL https://github.com/dhqdev/Bubu/releases/latest/download/install.sh | sudo bash
```

Ele pergunta o domínio (ex.: `bubu.seudominio.com`, já apontado para o IP da VPS) e faz o resto:

1. Instala o Docker se não tiver e liga o **Docker Swarm** se ainda não estiver ligado.
2. Cria a rede `network_public` se não existir.
3. **Traefik:** se já tiver um rodando (como o da sua stack do n8n), usa ele, com o certresolver `letsencryptresolver`.
   Se não tiver, sobe um Traefik v3 com HTTPS automático (Let's Encrypt).
4. Gera uma senha forte para o **Postgres** (fica só em `/opt/bubu/.env`, com permissão 600) e sobe a stack `bubu`
   (app + Postgres 16 com volume próprio).
5. Na Oracle, abre as portas 80/443 no iptables da máquina.
   **Também libere 80 e 443 na Security List da VCN** no painel da Oracle, senão o certificado não sai.

Sem perguntas: `curl ... | sudo BUBU_DOMINIO=bubu.seudominio.com BUBU_EMAIL=voce@email.com bash`.
Outras opções: `BUBU_VERSAO=v0.2.5` (fixa uma versão) e `BUBU_CERTRESOLVER=outro` (se o seu resolver tiver outro nome).

- **Atualizar:** rode o mesmo comando de novo (pega a release mais nova; o banco e a senha ficam).
- **Logs:** `docker service logs -f bubu_app`
- **Backup do banco:** `docker exec $(docker ps -qf name=bubu_postgres) pg_dump -U bubu bubu > bubu.sql`

Os arquivos da stack ficam em [`deploy/`](deploy/): `bubu-stack.yml` (app + Postgres, no mesmo padrão de labels da sua
stack do n8n) e `traefik-stack.yml` (só é usado se você ainda não tiver Traefik).

### Releases automáticas

Cada push na `main` roda os testes (com Postgres) e, se passarem, cria uma **release** `v0.2.N` com o `install.sh` e as
stacks anexados, e publica a imagem `ghcr.io/dhqdev/bubu` para amd64 e arm64.
Na primeira vez, deixe o pacote público em **GitHub → seu perfil → Packages → bubu → Package settings → Change visibility → Public**
(se ficar privado, o instalador baixa o código da release e monta a imagem na própria VPS, só demora mais).

## Como abrir no celular (o "escanear e abrir o app")

A ferramenta de escanear um QR code e abrir o app simulado no iPhone/Android é o **Expo Go**, mas ela só roda
apps feitos em React Native/Expo. O Bubu é um PWA, então **não precisa de Expo Go**: o próprio navegador do celular já
é o "simulador", e o QR code abre o jogo direto.

### Opção 1: no seu Wi-Fi (para testar enquanto programa)

```bash
npm run celular
```

Aparece um QR code no terminal. Aponte a câmera do celular (no mesmo Wi-Fi) e o Bubu abre no navegador.
Não precisa instalar nenhuma dependência para isso (só Node.js 18+).

> Pela rede local (http) o jogo funciona, mas o iPhone/Android só **instalam** como app e deixam offline quando o
> endereço é **https**. Para isso, use a opção 2.

### Opção 2: link público com HTTPS (para instalar como app)

O repositório já tem a publicação automática no **GitHub Pages** (`.github/workflows/release.yml`):

1. No GitHub, abra **Settings → Pages** e em **Source** escolha **GitHub Actions**.
2. Faça merge na `main`. Em 1 ou 2 minutos o site fica em `https://dhqdev.github.io/Bubu/`.
3. No jogo, **☰ Menu → Abrir no celular** mostra o QR code desse endereço.
4. Instale:
   - **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.
   - **Android (Chrome):** menu ⋮ → **Instalar app**.

(GitHub Pages em repositório privado exige plano pago. Alternativa grátis: arrastar a pasta para o Netlify Drop ou
importar o repositório na Vercel; o app é só arquivos estáticos.)

### Sobre o "xtools"

O projeto mais conhecido com esse nome é o [xtool](https://github.com/xtool-org/xtool), que compila apps **nativos de iOS
em Swift** fora do Mac. Ele não serve para PWA, então a escolha foi **HTML + CSS + JavaScript puro**, sem build:
abre em qualquer celular, é fácil de publicar e, mais pra frente, dá para empacotar o mesmo código como app de loja com
[Capacitor](https://capacitorjs.com/) (iOS e Android) sem reescrever.

## Rodar e testar no computador

```bash
npm run dev     # http://localhost:5173 (só o app, salva no aparelho)
npm test        # testes da rede, da vida, das criações e do servidor (node:test)

# com servidor e contas (precisa de um Postgres)
npm ci
DATABASE_URL=postgres://usuario:senha@localhost:5432/bubu npm start   # http://localhost:3000
TEST_DATABASE_URL=postgres://... npm test                               # roda também os testes da API
```

Para ver o ciclo de vida rápido: **☰ Menu → Ritmo da vida → Teste** (1 dia = 24 min).

## Como o cérebro funciona

A rede neural foi adaptada do [Pestinha](https://github.com/mille-okws/pestinha) (a versão para notebook, em Python),
reescrita em JavaScript para rodar no celular. São ~590 neurônios de integração e disparo com vazamento (LIF) e
~34 mil sinapses de nascença, e ele cria mais sozinho ao longo da vida:

```text
necessidades e você ──► sentidos (fome, sono, sujeira, tédio, solidão, carinho, cutucada, comida, banho, bronca...)
                              │  neurônios sensoriais (Poisson), com habituação
                              ▼
         interneurônios: alerta, curiosidade, vontade de brincar, calma, sono, frustração, tristeza, medo, carência
                              │
                              ▼
   motores de expressão (feliz, curioso, bravo, triste, sonolento, assustado, sereno)  →  a carinha dele
   motores de decisão (passear, pedir ajuda, perguntar, brincar sozinho, cochilar)     →  o que ele faz
```

- **Personalidade:** cada Bubu nasce com uma fiação e ganhos diferentes (curioso, grudento, medroso, dorminhoco...).
- **Habituação:** cutucar demais perde a graça; ele passa a reclamar.
- **O cérebro cresce sozinho:** neurônios que disparam juntos ganham uma ligação nova (até ~22 mil novas no adulto).
  As que continuam sendo usadas ficam fortes; as esquecidas enfraquecem e são podadas. Cada neurônio tem um limite de
  quanto pode receber, então nada sai do controle. As ligações criadas por ele aparecem em dourado na tela do cérebro.
- **Imaginação e memória:** dois grupos novos juntam o que ele já sabe (palavras, respostas, frases suas) com calma e
  curiosidade. Quando o neurônio de "criar" dispara forte, ele faz uma criação e vem te mostrar.
- **Aprendizado (três fatores):** o que estava acontecendo quando você deu carinho ou elogio passa a deixá-lo mais feliz;
  bronca faz o contrário. Fica salvo e passa (pela metade) para o próximo ovinho.

Arquivos: `js/brain.js` (rede), `js/brain-view.js` (tela do cérebro), `js/criatividade.js` (criações),
`js/conta.js` (conta e nuvem), `server/` (API e banco), `js/life.js` (necessidades e fases), `js/mind.js` (perguntas, palavras e truques),
`js/bubu-svg.js` (desenho), `js/main.js` (telas e interação), `js/games/` (mini-jogos).

## Próximos passos sugeridos

- Notificações ("o Bubu está com fome") com push.
- Mais cômodos (laboratório de poções, loja), mais jogos e visitas entre Bubus de amigos.
- Empacotar com Capacitor para a App Store e a Play Store.

## Licença

GPL-3.0, a mesma do Pestinha, de onde veio a ideia e a estrutura da rede neural. O gerador de QR code
(`js/vendor/qrcode.js`, Kazuhiko Arase) é MIT. Visual e personagem do Bubu são originais (inspirados no estilo dos pets virtuais, sem copiar arte de nenhum jogo).
