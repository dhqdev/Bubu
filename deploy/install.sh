#!/usr/bin/env bash
# =====================================================================
#  Instalador do Bubu (Docker Swarm + Traefik + Postgres)
#
#  Uso (na VPS, como root):
#    curl -fsSL https://github.com/dhqdev/Bubu/releases/latest/download/install.sh | sudo bash
#
#  Ou sem perguntas:
#    curl -fsSL .../install.sh | sudo BUBU_DOMINIO=bubu.seudominio.com BUBU_EMAIL=voce@email.com bash
#
#  Variáveis (opcionais):
#    BUBU_DOMINIO      domínio que aponta para esta VPS (registro A)
#    BUBU_EMAIL        e-mail do Let's Encrypt (só usado se o Traefik for instalado agora)
#    BUBU_VERSAO       tag da release (padrão: a mais recente)
#    BUBU_CERTRESOLVER nome do certresolver do seu Traefik (padrão: letsencryptresolver)
#    GITHUB_TOKEN      só se o repositório ficar privado
#
#  Rodar de novo = atualizar para a versão mais nova (as senhas e os dados ficam).
# =====================================================================
set -euo pipefail

REPO="dhqdev/Bubu"
DIR="/opt/bubu"
STACK="bubu"
REDE="network_public"
IMAGEM_REMOTA="ghcr.io/dhqdev/bubu"

cor() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
info() { cor "1;35" "🌱 $*"; }
ok() { cor "1;32" "✔ $*"; }
aviso() { cor "1;33" "⚠ $*"; }
erro() { cor "1;31" "✖ $*"; exit 1; }

perguntar() { # perguntar VAR "Texto" [padrao]
  local var="$1" texto="$2" padrao="${3:-}" resp=""
  if [ -n "${!var:-}" ]; then return; fi
  if [ -r /dev/tty ]; then
    printf '%s%s: ' "$texto" "${padrao:+ [$padrao]}" > /dev/tty
    read -r resp < /dev/tty || true
  fi
  resp="${resp:-$padrao}"
  [ -n "$resp" ] || erro "$texto é obrigatório."
  printf -v "$var" '%s' "$resp"
}

gh_curl() { # baixa da API/arquivos do GitHub (com token se tiver)
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" "$@"
  else
    curl -fsSL "$@"
  fi
}

[ "$(id -u)" -eq 0 ] || erro "Rode como root (use sudo)."
command -v curl >/dev/null || { apt-get update -qq && apt-get install -y -qq curl; }

ARCH="$(uname -m)"
case "$ARCH" in
  aarch64|arm64) PLATAFORMA="linux/arm64" ;;
  x86_64|amd64)  PLATAFORMA="linux/amd64" ;;
  *) erro "Arquitetura $ARCH não suportada." ;;
esac
info "Instalando o Bubu ($PLATAFORMA)"

# ---------- 1. Docker ----------
if ! command -v docker >/dev/null; then
  info "Docker não encontrado: instalando..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '?')"

# ---------- 2. Swarm ----------
if [ "$(docker info --format '{{.Swarm.LocalNodeState}}')" != "active" ]; then
  IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')"
  info "Iniciando o Docker Swarm (${IP:-auto})..."
  docker swarm init ${IP:+--advertise-addr "$IP"} >/dev/null
fi
ok "Swarm ativo"

# ---------- 3. Rede pública ----------
if ! docker network inspect "$REDE" >/dev/null 2>&1; then
  docker network create --driver overlay --attachable "$REDE" >/dev/null
  ok "Rede $REDE criada"
else
  ok "Rede $REDE já existe"
fi

# ---------- 4. Configuração salva (de uma instalação anterior) ----------
mkdir -p "$DIR"
ENV="$DIR/.env"
touch "$ENV"; chmod 600 "$ENV"
# o que veio na linha de comando vale mais que o arquivo; versão e imagem sempre são recalculadas
while IFS='=' read -r k v; do
  case "$k" in
    BUBU_VERSAO|BUBU_IMAGEM) ;;
    BUBU_*) [ -z "${!k:-}" ] && printf -v "$k" '%s' "$v" ;;
  esac
done < <(grep -E '^BUBU_[A-Z_]+=' "$ENV" || true)

# ---------- 5. Versão e arquivos ----------
if [ -z "${BUBU_VERSAO:-}" ]; then
  BUBU_VERSAO="$(gh_curl "https://api.github.com/repos/$REPO/releases/latest" | grep -m1 '"tag_name"' | cut -d'"' -f4 || true)"
fi
[ -n "$BUBU_VERSAO" ] || erro "Não achei nenhuma release em github.com/$REPO."
info "Versão: $BUBU_VERSAO"
BASE_DL="https://github.com/$REPO/releases/download/$BUBU_VERSAO"
gh_curl "$BASE_DL/bubu-stack.yml" -o "$DIR/bubu-stack.yml" || gh_curl "https://raw.githubusercontent.com/$REPO/$BUBU_VERSAO/deploy/bubu-stack.yml" -o "$DIR/bubu-stack.yml"
gh_curl "$BASE_DL/traefik-stack.yml" -o "$DIR/traefik-stack.yml" || gh_curl "https://raw.githubusercontent.com/$REPO/$BUBU_VERSAO/deploy/traefik-stack.yml" -o "$DIR/traefik-stack.yml"

# ---------- 6. Domínio e senha (gerada uma vez e reaproveitada) ----------
perguntar BUBU_DOMINIO "Domínio do Bubu (ex.: bubu.seudominio.com)"
BUBU_CERTRESOLVER="${BUBU_CERTRESOLVER:-letsencryptresolver}"
if [ -z "${BUBU_DB_SENHA:-}" ]; then
  BUBU_DB_SENHA="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
  ok "Senha do banco gerada"
fi

# ---------- 7. Traefik (só se ainda não tiver) ----------
if docker service ls --format '{{.Image}} {{.Name}}' | grep -i traefik >/dev/null || docker ps --format '{{.Image}}' | grep -i traefik >/dev/null; then
  ok "Traefik já está rodando: vou usar o seu (certresolver: $BUBU_CERTRESOLVER)"
else
  info "Traefik não encontrado: instalando..."
  perguntar BUBU_EMAIL "E-mail para os certificados HTTPS (Let's Encrypt)"
  TRAEFIK_EMAIL="$BUBU_EMAIL" docker stack deploy -c "$DIR/traefik-stack.yml" traefik >/dev/null
  BUBU_CERTRESOLVER="letsencryptresolver"
  ok "Traefik instalado"
fi

# Portas 80/443 no firewall do Ubuntu da Oracle (que vem bloqueando tudo menos a 22)
if command -v iptables >/dev/null && iptables -S INPUT 2>/dev/null | grep -- "-j REJECT" >/dev/null; then
  for p in 80 443; do
    iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p tcp --dport "$p" -j ACCEPT
  done
  command -v netfilter-persistent >/dev/null && netfilter-persistent save >/dev/null 2>&1 || true
  ok "Portas 80 e 443 liberadas no iptables (lembre de liberar também na Security List da Oracle)"
fi

# ---------- 8. Imagem ----------
BUBU_IMAGEM="$IMAGEM_REMOTA:$BUBU_VERSAO"
if docker pull --platform "$PLATAFORMA" "$BUBU_IMAGEM" >/dev/null 2>&1; then
  ok "Imagem baixada: $BUBU_IMAGEM"
else
  aviso "Não consegui baixar $BUBU_IMAGEM; vou montar a imagem aqui mesmo."
  TMP="$(mktemp -d)"
  gh_curl "https://api.github.com/repos/$REPO/tarball/$BUBU_VERSAO" -o "$TMP/src.tgz"
  tar -xzf "$TMP/src.tgz" -C "$TMP" --strip-components=1
  BUBU_IMAGEM="bubu:$BUBU_VERSAO"
  docker build --build-arg BUBU_VERSAO="$BUBU_VERSAO" -t "$BUBU_IMAGEM" "$TMP"
  rm -rf "$TMP"
  ok "Imagem montada: $BUBU_IMAGEM"
fi

# ---------- 9. Salvar config e subir ----------
cat > "$ENV" <<EOT
# Gerado pelo instalador do Bubu. NÃO troque a BUBU_DB_SENHA depois de instalado.
BUBU_DOMINIO=$BUBU_DOMINIO
BUBU_EMAIL=${BUBU_EMAIL:-}
BUBU_CERTRESOLVER=$BUBU_CERTRESOLVER
BUBU_DB_SENHA=$BUBU_DB_SENHA
BUBU_IMAGEM=$BUBU_IMAGEM
BUBU_VERSAO=$BUBU_VERSAO
EOT
chmod 600 "$ENV"

info "Subindo a stack '$STACK'..."
export BUBU_DOMINIO BUBU_CERTRESOLVER BUBU_DB_SENHA BUBU_IMAGEM
docker stack deploy --with-registry-auth -c "$DIR/bubu-stack.yml" "$STACK" >/dev/null

# espera o app responder
for _ in $(seq 1 60); do
  if docker service ps "${STACK}_app" --filter desired-state=running --format '{{.CurrentState}}' 2>/dev/null | grep '^Running' >/dev/null; then
    break
  fi
  sleep 3
done
docker service ls --filter "name=${STACK}_"

echo
ok "Pronto! Abra: https://$BUBU_DOMINIO"
echo "   • Configuração: $ENV"
echo "   • Logs:          docker service logs -f ${STACK}_app"
echo "   • Atualizar:     rode este instalador de novo"
echo "   • Backup:        docker exec \$(docker ps -qf name=${STACK}_postgres) pg_dump -U bubu bubu > bubu.sql"
