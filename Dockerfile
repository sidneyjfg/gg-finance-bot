# ---------- STAGE 1 ----------
FROM node:18-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

RUN npx prisma generate
RUN npm run build


# ---------- STAGE 2 ----------
FROM node:18-slim
WORKDIR /app

# Puppeteer deps mínimos
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libasound2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libx11-xcb1 \
  libgtk-3-0 \
  xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# 🔥 FORÇA Puppeteer a baixar o Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=false

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
