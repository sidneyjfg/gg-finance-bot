
import { TransacaoRepository } from "../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";

export class GastoPorCategoriaHandler {
  static async executar(telefone: string, usuarioId: string) {
    const resultados = await TransacaoRepository.gastosPorCategoria(usuarioId);

    if (!resultados.length) {
      await EnviadorWhatsApp.enviar(
        telefone,
        "📊 Ainda não encontrei despesas concluídas para calcular por categoria.\n" +
          "Tente registrar algumas despesas primeiro e depois pergunte novamente 😉."
      );
      return;
    }

    const formatar = (valor: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      }).format(valor);

    const linhas = resultados.map(
      (r) => `• *${r.nome}*: ${formatar(r.total)}`
    );

    const totalGeral = resultados.reduce((acc, r) => acc + r.total, 0);

    const mensagem =
      "📊 *Resumo de gastos por categoria*\n\n" +
      linhas.join("\n") +
      `\n\n💰 *Total gasto:* ${formatar(totalGeral)}\n` +
      "_(considerando apenas despesas marcadas como concluídas)_";

    await EnviadorWhatsApp.enviar(telefone, mensagem);
  }
}
