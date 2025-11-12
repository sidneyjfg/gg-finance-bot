import { FastifyInstance } from "fastify";
import { whatsappWebhook } from "../webhooks/whatsapp.webhook";

export async function appRoutes(app: FastifyInstance) {
  // Aqui entram todas as rotas do sistema
  app.get("/", async () => ({ status: "API online 🚀" }));

  // Webhooks
  await whatsappWebhook(app);

  // Futuras rotas:
}
