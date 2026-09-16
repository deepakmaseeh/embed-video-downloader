# Embed Video Downloader API — for Render / Docker
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip curl ffmpeg ca-certificates \
  && pip3 install --break-system-packages --no-cache-dir yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev --ignore-scripts

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

RUN mkdir -p downloads/completed data

ENV NODE_ENV=production
ENV PORT=8788
EXPOSE 8788

CMD ["node", "dist/index.js"]
