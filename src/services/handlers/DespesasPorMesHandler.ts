import { TransacaoRepository } from "../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";
import { StatusTransacao } from "@prisma/client";
import { intervaloMes } from "../../utils/periodo";

export class DespesasPorMesHandler {
  static async executar(
    telefone: string,
    usuarioId: string,
    mes: number, // 1..12
    ano: number,
    mostrarTodas: boolean = false
  ) {
    const { inicio, fim } = intervaloMes(mes, ano);

    const despesas = await TransacaoRepository.filtrar({
      usuarioId,
      tipo: "despesa",
      status: StatusTransacao.concluida,
      dataInicio: inicio,
      dataFim: fim,
    });

    if (!despesas.length) {
      await EnviadorWhatsApp.enviar(
        telefone,
        `💸 Não encontrei despesas registradas para ${String(mes).padStart(2, "0")}/${ano}.`
      );
      return;
    }

    const formatar = (valor: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      }).format(valor);

    const total = despesas.reduce((acc, d) => acc + Number(d.valor), 0);

    const limitePadrao = 30;
    const lista = mostrarTodas ? despesas : despesas.slice(0, limitePadrao);

    const linhas = lista.map((d) => {
      const data = d.data ? new Date(d.data).toLocaleDateString("pt-BR") : "-";
      const desc = d.descricao ?? "Sem descrição";
      return `• ${data} - ${desc}: ${formatar(Number(d.valor))}`;
    });

    const textoLimite = mostrarTodas
      ? ""
      : `\n\n_(mostrando as ${lista.length} mais recentes)_`;

    const mensagem =
      `💸 *Despesas de ${String(mes).padStart(2, "0")}/${ano}*\n\n` +
      linhas.join("\n") +
      `\n\n💰 *Total do mês:* ${formatar(total)}` +
      textoLimite;

    await EnviadorWhatsApp.enviar(telefone, mensagem);
  }
}
