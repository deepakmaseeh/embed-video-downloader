# Embed Video Downloader API — for Render / Docker
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip curl ffmpeg ca-certificates \
  && pip3 install --break-system-packages --no-cache-dir yt-dlp 'curl_cffi>=0.7.0' \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
# Install all deps (incl. typescript) for build, then prune
RUN npm ci --ignore-scripts || npm install --ignore-scripts

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npx tsc -p tsconfig.json \
  && npm prune --omit=dev

RUN mkdir -p downloads/completed data \
  && chmod +x scripts/cf_fetch.py

ENV NODE_ENV=production
ENV PORT=8788
EXPOSE 8788

CMD ["node", "dist/index.js"]
