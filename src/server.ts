import Fastify from "fastify";
import { rateLimitMiddleware } from "./middlewares/rateLimit.middleware";
import { authMiddleware } from "./middlewares/auth.middleware";
import { logger } from "./utils/logger";
import { env } from "./config/env";
import { appRoutes } from "./routes";

async function bootstrap() {
  const app = Fastify();

  // Middlewares globais
  await rateLimitMiddleware(app);
  app.addHook("onRequest", authMiddleware);

  // Carrega todas as rotas em 1 lugar ✅
  await appRoutes(app);

  const PORT = env.PORT;

  app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
    if (err) {
      logger.error("Erro ao subir servidor", err);
      process.exit(1);
    }
    logger.info(`Servidor rodando em http://localhost:${PORT} 🚀`);
  });
}

bootstrap();
