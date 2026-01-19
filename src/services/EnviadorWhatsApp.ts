import { logger } from "../utils/logger";
import { client } from "../whatsapp/bot";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class EnviadorWhatsApp {
  static async enviar(destino: string, mensagem: string) {
    try {
      await sleep(1000); // 🔥 essencial para @lid

      const chat = await client.getChatById(destino);
      logger.info(`Chat Encontrado: ${chat}`);
      // neutraliza sendSeen interno
      // @ts-ignore
      chat.sendSeen = async () => {};

      await chat.sendMessage(mensagem);
      return;
    } catch (error) {
      console.error("❌ Falha definitiva ao enviar mensagem:", error);
    }
  }
}
