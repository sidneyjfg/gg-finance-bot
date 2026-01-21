import Fastify from "fastify";
import { authMiddleware } from "./middlewares/auth.middleware";
import { logger } from "./utils/logger";
import { env } from "./config/env";

import { appRoutes } from "./routes";
import { startWhatsAppBot } from "./whatsapp/bot";
import { iniciarSchedulers } from "./infra/scheduler";

import { connectDatabase } from "./infra/prisma";

async function bootstrap() {
  try {
    const app = Fastify();

    logger.info("🚀 Iniciando aplicação...");

    // 1️⃣ Middlewares globais
    app.addHook("onRequest", authMiddleware);

    // 2️⃣ Conectar no banco
    logger.info("🔌 Conectando ao banco...");
    await connectDatabase();

    // 3️⃣ Registrar rotas
    logger.info("🛣️ Registrando rotas...");
    await appRoutes(app);

    // 4️⃣ Iniciar schedulers
    logger.info("⏰ Iniciando schedulers...");
    await iniciarSchedulers();

    // 5️⃣ Iniciar WhatsApp Bot
    logger.info("🤖 Iniciando WhatsApp bot...");
    await startWhatsAppBot();

    // 6️⃣ Subir servidor SOMENTE se tudo estiver ok
    const PORT = env.PORT;

    await app.listen({ port: PORT, host: "0.0.0.0" });

    logger.info(`✅ Servidor rodando em http://localhost:${PORT}`);
  } catch (error) {
    logger.error("❌ Falha crítica ao iniciar aplicação", error);
    process.exit(1);
  }
}

bootstrap();
