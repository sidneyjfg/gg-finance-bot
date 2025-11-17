import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const modelo = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export class RespostaGemini {

  static async gerar(contexto: string) {
    const prompt = `
Você é um assistente financeiro no WhatsApp.
Gere uma resposta amigável, natural e clara sempre entendendo o que o usuário necessita.

Contexto:
${contexto}
    `;  

    const out = await modelo.generateContent(prompt);
    return out.response.text();
  }
}
