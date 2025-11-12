import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';

const app = Fastify({ logger: true });

// middlewares
app.register(cors);

// rota health check
app.get('/health', async () => {
  return { status: 'ok' };
});

export { app };
