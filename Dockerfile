# Imagem do Bubu (app + API). Multi-arquitetura: roda em arm64 (Oracle Ampere) e amd64.
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY index.html manifest.webmanifest sw.js ./
COPY css ./css
COPY js ./js
COPY icons ./icons
COPY server ./server
ARG BUBU_VERSAO=dev
ENV BUBU_VERSAO=$BUBU_VERSAO
LABEL org.opencontainers.image.source="https://github.com/dhqdev/Bubu" \
      org.opencontainers.image.description="Bubu: bichinho virtual com vida própria" \
      org.opencontainers.image.licenses="GPL-3.0-or-later"
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/saude >/dev/null || exit 1
CMD ["node", "server/index.mjs"]
