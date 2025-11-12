import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { logger } from "../utils/logger";
import { OrquestradorConversa } from "../services/OrquestradorConversa";

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
    console.log(`📩 ${msg.from}: ${msg.body}`);
    // Ignora mensagens de grupos
    if (msg.from.includes("@g.us")) {
      console.log("📵 Mensagem de grupo ignorada.");
      return;
    }
    if (msg.from.includes("554192124976@c.us")) {
      console.log("📵 Mensagem de Suzy ignorada.");
      return;
    }
    if (msg.from.includes("554196987208@c.us")) {
      console.log("📵 Mensagem de Outros ignorada.");
      return;
    }
    if (msg.from.includes("558597280182@c.us")) {
      try {
        await OrquestradorConversa.processar(msg.from, msg.body);
      } catch (error) {
        console.error("❌ Erro ao processar mensagem:", error);
      }
    }

  });

  client.initialize();
}
