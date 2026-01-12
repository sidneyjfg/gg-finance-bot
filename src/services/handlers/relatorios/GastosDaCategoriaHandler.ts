import { TransacaoRepository } from "../../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";


export class GastosDaCategoriaHandler {
  static async executar(
    telefone: string,
    usuarioId: string,
    nomeCategoria: string
  ) {
    const transacoes =
      await TransacaoRepository.listarDespesasPorCategoriaNome(
        usuarioId,
        nomeCategoria
      );

    if (!transacoes.length) {
      await EnviadorWhatsApp.enviar(
        telefone,
        `📂 Não encontrei despesas na categoria *${nomeCategoria}* ainda.`
      );
      return;
    }

    const formatar = (valor: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      }).format(valor);

    const linhas = transacoes.map((t) => {
      const data = t.data
        ? new Date(t.data).toLocaleDateString("pt-BR")
        : "-";
      const desc = t.descricao ?? "Sem descrição";
      return `• ${data} - ${desc}: ${formatar(Number(t.valor))}`;
    });

    const total = transacoes.reduce(
      (acc, t) => acc + Number(t.valor),
      0
    );

    const mensagem =
      `📂 *Gastos na categoria ${nomeCategoria}*\n\n` +
      linhas.join("\n") +
      `\n\n💰 *Total nessa categoria:* ${formatar(total)}`;

    await EnviadorWhatsApp.enviar(telefone, mensagem);
  }
}
