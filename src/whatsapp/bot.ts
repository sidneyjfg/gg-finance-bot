import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { logger } from "../utils/logger";
import { BotService } from "../services/bot.service"; // AGORA USAMOS O NOVO FLUXO
import { EnviadorWhatsApp } from "../services/EnviadorWhatsApp";

export const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process'
    ]
  }
});

export function startWhatsAppBot() {
  client.on("qr", (qr) => {
    console.log("\n📌 Escaneie o QR abaixo:\n");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    logger.info("✅ WhatsApp conectado e pronto!");
  });

  client.on("auth_failure", () => logger.error("❌ Falha na autenticação"));

  client.on("message", async (msg) => {

    // ❌ ignora grupos
    if (msg.from.endsWith("@g.us")) return;

    const mensagem = msg.body;

    // 🔑 CHAT REAL (resolve @lid corretamente)
    const chat = await msg.getChat();
    const chatId = chat.id._serialized;

    // garante que é contato individual
    if (!chatId.endsWith("@c.us")) {
      console.log("⚠️ Chat inválido ignorado:", chatId);
      return;
    }

    const telefone = chatId.replace("@c.us", "");

    console.log(`📩 ${telefone}: ${mensagem}`);
    console.log("Aguardando nova mensagem");

    try {
      // ✔️ fluxo normal do assistente
      await BotService.processarMensagem(telefone, mensagem);

    } catch (error: any) {
      const mensagemErro = error?.message || "";
      const status = error?.status || error?.code;

      if (status === 429 || mensagemErro.includes("429")) {
        await EnviadorWhatsApp.enviar(
          telefone,
          "⏳ *Calma lá!* Você está usando o assistente muito rápido.\n" +
          "Aguarde alguns instantes 🙂"
        );
        return;
      }

      const erroIA =
        mensagemErro.includes("API key") ||
        mensagemErro.includes("generative") ||
        mensagemErro.includes("Gemini") ||
        mensagemErro.includes("OpenAI") ||
        status === 500 ||
        status === 503;

      if (erroIA) {
        await EnviadorWhatsApp.enviar(
          telefone,
          "🤖 *IA temporariamente indisponível.*\n" +
          "Tente novamente em instantes."
        );
        return;
      }

      await EnviadorWhatsApp.enviar(
        telefone,
        "❌ Ocorreu um erro inesperado.\nTente novamente mais tarde."
      );
    }
  });

  client.initialize();
}
