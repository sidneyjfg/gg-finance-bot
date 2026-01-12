import { StatusTransacao } from "@prisma/client";
import { TransacaoRepository } from "../../../repositories/transacao.repository";
import { intervaloMes } from "../../../utils/periodo";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";


export class ReceitasPorMesHandler {
  static async executar(
    telefone: string,
    usuarioId: string,
    mes: number, // 1..12
    ano: number,
    mostrarTodas: boolean = false
  ) {
    const { inicio, fim } = intervaloMes(mes, ano);

    const receitas = await TransacaoRepository.filtrar({
      usuarioId,
      tipo: "receita",
      status: StatusTransacao.concluida,
      dataInicio: inicio,
      dataFim: fim,
    });

    if (!receitas.length) {
      await EnviadorWhatsApp.enviar(
        telefone,
        `📈 Não encontrei receitas registradas para ${String(mes).padStart(2, "0")}/${ano}.`
      );
      return;
    }

    const formatar = (valor: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      }).format(valor);

    const total = receitas.reduce((acc, r) => acc + Number(r.valor), 0);

    const limitePadrao = 30;
    const lista = mostrarTodas ? receitas : receitas.slice(0, limitePadrao);

    const linhas = lista.map((r) => {
      const data = r.data ? new Date(r.data).toLocaleDateString("pt-BR") : "-";
      const desc = r.descricao ?? "Sem descrição";
      return `• ${data} - ${desc}: ${formatar(Number(r.valor))}`;
    });

    const textoLimite = mostrarTodas
      ? ""
      : `\n\n_(mostrando as ${lista.length} mais recentes)_`;

    const mensagem =
      `📈 *Receitas de ${String(mes).padStart(2, "0")}/${ano}*\n\n` +
      linhas.join("\n") +
      `\n\n💰 *Total do mês:* ${formatar(total)}` +
      textoLimite;

    await EnviadorWhatsApp.enviar(telefone, mensagem);
  }
}
