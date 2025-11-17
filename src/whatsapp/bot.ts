import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { logger } from "../utils/logger";
import { BotService } from "../services/bot.service"; // AGORA USAMOS O NOVO FLUXO

export const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: false,
    args: ["--no-sandbox"]
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
      console.log("📵 Mensagem de grupo ignorada.");
      return;
    }

    // 🔒 Número autorizado (SOMENTE VOCÊ)
    const numeroAutorizado = "558597280182"; // <- SEU NÚMERO AQUI

    // ❌ Ignora qualquer número que não seja o seu
    if (telefone !== numeroAutorizado) {
      console.log(`🚫 Ignorando número não autorizado: ${telefone}`);
      return;
    }

    // ✔️ Processa com a IA
    try {
      await BotService.processarMensagem(telefone, mensagem);
    } catch (error) {
      console.error("❌ Erro ao processar mensagem:", error);
    }
  });

  client.initialize();
}
