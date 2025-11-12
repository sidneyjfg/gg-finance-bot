import fastifyRateLimit from "@fastify/rate-limit";
import { FastifyInstance } from "fastify";

export async function rateLimitMiddleware(app: FastifyInstance) {
  await app.register(fastifyRateLimit, {
    max: 30, // 30 requisições
    timeWindow: "1 minute",
    errorResponseBuilder: (req, ctx) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Muitas requisições, tente novamente em instantes.",
    }),
  });
}
