import { TransacaoRepository } from "../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";
import { StatusTransacao } from "@prisma/client";

export class RelatorioDespesasPeriodoHandler {
  static async despesasDoMesAtual(telefone: string, usuarioId: string) {
    const agora = new Date();

    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);

    const despesas = await TransacaoRepository.filtrar({
      usuarioId,
      tipo: "despesa",
      status: StatusTransacao.concluida,
      dataInicio: inicioMes,
      dataFim: fimMes,
    });

    if (!despesas.length) {
      await EnviadorWhatsApp.enviar(
        telefone,
        "💸 Você ainda não tem despesas registradas neste mês."
      );
      return;
    }

    const formatar = (valor: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      }).format(valor);

    const total = despesas.reduce(
      (acc, d) => acc + Number(d.valor),
      0
    );

    // mostra só as 10 mais recentes pra não ficar gigante
    const recentes = despesas.slice(0, 15);

    const linhas = recentes.map((d) => {
      const data = d.data
        ? new Date(d.data).toLocaleDateString("pt-BR")
        : "-";
      const desc = d.descricao ?? "Sem descrição";
      return `• ${data} - ${desc}: ${formatar(Number(d.valor))}`;
    });

    const mensagem =
      "💸 *Despesas deste mês*\n\n" +
      linhas.join("\n") +
      `\n\n💰 *Total de despesas no mês:* ${formatar(total)}\n` +
      "_(mostrando as 15 mais recentes)_";

    await EnviadorWhatsApp.enviar(telefone, mensagem);
  }
}
