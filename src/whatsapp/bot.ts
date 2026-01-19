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
    const telefone = msg.from.replace("@c.us", "");
    const mensagem = msg.body;

    console.log(`📩 ${telefone}: ${mensagem}`);

    // ❌ Ignora mensagens de grupos
    if (msg.from.includes("@g.us")) {
      return;
    }

    console.log("Aguardando nova mensagem");
    // ✔️ Processa com a IA
    try {
      await BotService.processarMensagem(telefone, mensagem);
    } catch (error: any) {
      const mensagemErro = error?.message || "";
      const status = error?.status || error?.code;

      // 🚦 RATE LIMIT (429)
      if (status === 429 || mensagemErro.includes("429")) {
        console.warn("🚦 Rate limit atingido:", {
          telefone,
          mensagem: mensagemErro
        });

        await EnviadorWhatsApp.enviar(
          telefone,
          "⏳ *Calma lá!* Você está usando o assistente muito rápido.\n" +
          "Para evitar custos e instabilidade, aguarde alguns instantes e tente novamente 🙂"
        );

        return;
      }

      // 🤖 Erros relacionados à IA
      const erroIA =
        mensagemErro.includes("API key") ||
        mensagemErro.includes("generative") ||
        mensagemErro.includes("Gemini") ||
        mensagemErro.includes("OpenAI") ||
        status === 500 ||
        status === 503;

      if (erroIA) {
        console.error("🤖 Erro na IA:", {
          status,
          mensagem: mensagemErro
        });

        await EnviadorWhatsApp.enviar(
          telefone,
          "🤖 *IA temporariamente indisponível.*\n" +
          "Estamos ajustando as engrenagens aqui. Tente novamente em instantes."
        );

        return;
      }

      // ❌ Erro genérico
      console.error("❌ Erro ao processar mensagem:", error?.message || error);

      await EnviadorWhatsApp.enviar(
        telefone,
        "❌ Ocorreu um erro inesperado.\nSe persistir, tente novamente mais tarde."
      );
    }

  });

  client.initialize();
}
