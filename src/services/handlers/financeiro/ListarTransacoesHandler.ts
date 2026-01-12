import { TransacaoRepository } from "../../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";

export class ListarTransacoesHandler {
  static async executar(telefone: string, usuarioId: string, limite: number = 10) {
    // pega todas (receita + despesa) mais recentes
    const transacoes = await TransacaoRepository.listarRecentes(usuarioId);

    if (!transacoes.length) {
      await EnviadorWhatsApp.enviar(
        telefone,
        "📭 Você ainda não tem transações registradas.\n" +
          "Me diga uma despesa/receita pra eu registrar 😉"
      );
      return;
    }

    const formatar = (valor: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      }).format(valor);

    const lista = transacoes.slice(0, limite);

    const linhas = lista.map((t) => {
      const data = t.data ? new Date(t.data).toLocaleDateString("pt-BR") : "-";
      const desc = t.descricao ?? "Sem descrição";
      const emoji = t.tipo === "receita" ? "🔺" : "🔻";
      return `• ${data} ${emoji} ${desc}: ${formatar(Number(t.valor))}`;
    });

    const texto =
      `🧾 *Últimas transações*\n\n` +
      linhas.join("\n") +
      `\n\n_(mostrando as ${lista.length} mais recentes)_`;

    await EnviadorWhatsApp.enviar(telefone, texto);
  }
}
