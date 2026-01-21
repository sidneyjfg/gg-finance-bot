import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export async function connectDatabase() {
  try {
    console.log("🔌 Conectando ao banco...");

    // 1️⃣ Abre pool de conexões
    await prisma.$connect();

    // 2️⃣ Valida que o banco responde
    await prisma.$queryRaw`SELECT 1`;

    console.log("✅ Prisma conectado e banco respondendo");
  } catch (error) {
    console.error("❌ Banco de dados indisponível");
    throw error;
  }
}
