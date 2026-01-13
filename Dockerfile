# ---------- STAGE 1: Build ----------
FROM node:18-bullseye AS builder

WORKDIR /app

# Dependências para Prisma
RUN apt-get update && apt-get install -y \
  openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Prisma
RUN npx prisma generate

# Build TypeScript
RUN npm run build


# ---------- STAGE 2: Runtime ----------
FROM node:18-bullseye

WORKDIR /app

# 🔥 DEPENDÊNCIAS DO CHROMIUM (ESSENCIAL)
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  libnss3 \
  libatk-bridge2.0-0 \
  libgtk-3-0 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  xdg-utils \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Variável usada pelo Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]