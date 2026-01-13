import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'test', 'prod']).default('dev'),
  PORT: z.coerce.number().default(3333),

  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(3306),
  DB_NAME: z.string().min(1),

  API_KEY: z.string(),
  GEMINI_API_KEY: z.string(),
  WEBHOOK_SECRET: z.string()
})

const _env = envSchema.parse(process.env)

// 🔥 Monta a DATABASE_URL AQUI
const DATABASE_URL = `mysql://${_env.DB_USER}:${encodeURIComponent(
  _env.DB_PASSWORD
)}@${_env.DB_HOST}:${_env.DB_PORT}/${_env.DB_NAME}`

// 🔥 Injeta no process.env para o Prisma
process.env.DATABASE_URL = DATABASE_URL

export const env = {
  ..._env,
  DATABASE_URL
}
