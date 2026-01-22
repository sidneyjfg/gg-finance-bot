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
    logger.info("✅ WhatsApp conectado e pronto!");

    // 🔥 PATCH GLOBAL — desativa sendSeen bugado do WhatsApp Web
    try {
      const page = (client as any).pupPage;

      if (!page) {
        logger.warn("⚠️ puppeteer page não encontrada  para patch sendSeen");
        return;
      }

      await page.evaluate(() => {
        // @ts-ignore
        if (window.WWebJS && window.WWebJS.sendSeen) {
          // @ts-ignore
          window.WWebJS.sendSeen = async () => { };
        }
      });

      logger.info("🛡️ Patch sendSeen aplicado com sucesso");
    } catch (err) {
      logger.error("❌ Erro ao aplicar patch sendSeen", err);
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

    // 🔒 número autorizado (SEM @c.us)
    const numeroAutorizado = "558598330231";

    // 📞 extrai telefone do remetente
    const telefone = msg.from.replace("@c.us", "");

    // 🚫 bloqueia qualquer outro número
    if (telefone !== numeroAutorizado) {
      console.log(`🚫 Ignorando número não autorizado: ${telefone}`);
      return;
    }

    // 🔑 IDENTIDADE ÚNICA (agora só chega aqui se for autorizado)
    const userId = chat.id._serialized;

    logger.info(`\nuserId: ${userId}\nmensagem: ${mensagem}`);
    console.log(`📩 ${userId}: ${mensagem}`);

    try {
      await BotService.processarMensagem(userId, mensagem);
    } catch (error: any) {
      const mensagemErro = error?.message || "";
      const status = error?.status || error?.code;

      // ✅ LOG DO ERRO REAL (isso é o principal)
      logger.error(
        `❌ Erro ao processar mensagem | userId=${userId} | mensagem="${mensagem}" | status=${status} | name=${error?.name} | msg="${mensagemErro}"`
      );
      console.error("[ERRO OBJETO]", error);

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
