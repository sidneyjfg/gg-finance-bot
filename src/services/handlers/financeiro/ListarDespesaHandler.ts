import { TransacaoRepository } from "../../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";

type TransacaoComCategoria = Awaited<
  ReturnType<typeof TransacaoRepository.listarDetalhadoPorTipo>
>[number];

export class ListarDespesasHandler {
  static async executar(
    telefone: string,
    usuarioId: string,
    mostrarTodas: boolean = false
  ) {
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
        maximumFractionDigits: 2,
      }).format(valor);

    const limitePadrao = 30;
    const lista = mostrarTodas ? despesas : despesas.slice(0, limitePadrao);

    const linhas = lista.map((d) => {
      const data = d.data
        ? new Date(d.data).toLocaleDateString("pt-BR")
        : "-";
      const desc = d.descricao ?? "Sem descrição";
      const categoria = (d as TransacaoComCategoria).categoria?.nome ?? "Sem categoria";
      return `• ${data} - ${desc} (${categoria}): ${formatar(
        Number(d.valor)
      )}`;
    });

    const total = despesas.reduce(
      (acc, d) => acc + Number(d.valor),
      0
    );

    const textoLimite = mostrarTodas
      ? ""
      : `\n\n_(mostrando as ${lista.length} mais recentes)_`;

    const mensagem =
      "💸 *Suas despesas registradas*\n\n" +
      linhas.join("\n") +
      `\n\n💰 *Total de despesas:* ${formatar(total)}` +
      textoLimite;

    await EnviadorWhatsApp.enviar(telefone, mensagem);
  }
}
