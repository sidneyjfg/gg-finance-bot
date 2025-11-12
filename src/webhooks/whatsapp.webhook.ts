import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { logger } from "../utils/logger";

const webhookSchema = z.object({
  from: z.string(),
  message: z.string().min(1),
});

export async function whatsappWebhook(app: FastifyInstance) {
  app.post(
    "/webhook/whatsapp",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = webhookSchema.parse(request.body);
        const userPhone = body.from;
        const message = body.message;

        logger.info(`Mensagem recebida do WhatsApp: ${userPhone}`);

        // TODO: localizar/criar usuário no banco
        // TODO: processar intenção, salvar logs, responder usuário, etc

        return reply.status(200).send({ status: "received" });
      } catch (err) {
        logger.error("Erro no webhook WhatsApp", err);
        return reply.status(400).send({ error: "Invalid payload" });
      }
    }
  );
}
