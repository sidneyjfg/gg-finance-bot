import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const apiKey = request.headers["x-api-key"];

  if (!apiKey || apiKey !== env.API_KEY) {
    logger.warn("Acesso não autorizado bloqueado.");
    return reply.status(401).send({ error: "Não autorizado" });
  }
}
