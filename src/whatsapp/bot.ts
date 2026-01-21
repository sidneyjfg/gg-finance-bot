// whatsapp.bot.ts
import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { logger } from "../utils/logger";
import { BotService } from "../services/bot.service";
import { EnviadorWhatsApp } from "../services/EnviadorWhatsApp";

export const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process"
    ]
  }
});

export function startWhatsAppBot() {
  client.on("qr", (qr) => {
    console.log("\n📌 Escaneie o QR abaixo:\n");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", async () => {
    logger.info("🤖 WhatsApp conectado, aguardando estabilização...");

    try {
      const page = (client as any).pupPage;

      if (!page) {
        throw new Error("Puppeteer page não encontrada");
      }

      // 🔥 Aguarda o WhatsApp Web estar realmente pronto
      await page.waitForFunction(
        () => {
          // @ts-ignore
          return window.Store && window.Store.Chat && window.Store.Chat.models.length > 0;
        },
        { timeout: 20000 }
      );

      logger.info("✅ WhatsApp totalmente carregado (Store pronto)");

      // 🛡️ Aplica o patch sendSeen depois que o Store existir
      await page.evaluate(() => {
        // @ts-ignore
        if (window.WWebJS?.sendSeen) {
          // @ts-ignore
          window.WWebJS.sendSeen = async () => { };
        }
      });

      logger.info("🛡️ Patch sendSeen aplicado com sucesso");

    } catch (error) {
      logger.error("❌ Falha ao estabilizar WhatsApp Web", error);
      process.exit(1); // 💥 NÃO deixa o sistema rodar em estado quebrado
    }
  });


  client.on("auth_failure", () =>
    logger.error("❌ Falha na autenticação")
  );

  client.on("message", async (msg) => {
    // ❌ ignora grupos
    if (msg.from.endsWith("@g.us")) return;

    const mensagem = msg.body.trim();
    const chat = await msg.getChat();

    // 🔑 IDENTIDADE ÚNICA
    const userId = chat.id._serialized; // @lid ou @c.us
    logger.info(`\nuserId: ${userId}\nmensagem: ${mensagem}`);
    console.log(`📩 ${userId}: ${mensagem}`);

    try {
      await BotService.processarMensagem(userId, mensagem);
    } catch (error: any) {
      const mensagemErro = error?.message || "";
      const status = error?.status || error?.code;

      if (status === 429 || mensagemErro.includes("429")) {
        await EnviadorWhatsApp.enviar(
          userId,
          "⏳ *Calma lá!* Você está usando o assistente muito rápido.\nAguarde alguns instantes 🙂"
        );
        return;
      }

      const erroIA =
        mensagemErro.includes("API key") ||
        mensagemErro.includes("Gemini") ||
        mensagemErro.includes("OpenAI") ||
        status === 500 ||
        status === 503;

      if (erroIA) {
        await EnviadorWhatsApp.enviar(
          userId,
          "🤖 *IA temporariamente indisponível.*\nTente novamente em instantes."
        );
        return;
      }

      await EnviadorWhatsApp.enviar(
        userId,
        "❌ Ocorreu um erro inesperado.\nTente novamente mais tarde."
      );
    }
  });

  client.initialize();
}
