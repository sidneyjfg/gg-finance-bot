import { TransacaoRepository } from "../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";

export class ListarDespesasHandler {
  static async executar(telefone: string, usuarioId: string) {
    const despesas = await TransacaoRepository.listarDetalhadoPorTipo(
      usuarioId,
      "despesa"
    );

    if (!despesas.length) {
      await EnviadorWhatsApp.enviar(
        telefone,
        "💸 Você ainda não tem despesas registradas."
      );
      return;
    }

    const formatar = (valor: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2
      }).format(valor);

    const recentes = despesas.slice(0, 15);

    const linhas = recentes.map((d) => {
      const data = d.data
        ? new Date(d.data).toLocaleDateString("pt-BR")
        : "-";
      const desc = d.descricao ?? "Sem descrição";
      const categoria = d.categoria?.nome ?? "Sem categoria";
      return `• ${data} - ${desc} (${categoria}): ${formatar(
        Number(d.valor)
      )}`;
    });

    const total = despesas.reduce(
      (acc, d) => acc + Number(d.valor),
      0
    );

    const mensagem =
      "💸 *Suas despesas registradas*\n\n" +
      linhas.join("\n") +
      `\n\n💰 *Total de despesas:* ${formatar(total)}\n` +
      "_(mostrando as 15 mais recentes)_";

    await EnviadorWhatsApp.enviar(telefone, mensagem);
  }
}
