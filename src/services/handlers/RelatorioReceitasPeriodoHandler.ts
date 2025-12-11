import { TransacaoRepository } from "../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";
import { StatusTransacao } from "@prisma/client";

export class RelatorioReceitasPeriodoHandler {
  static async receitasDoMesAtual(telefone: string, usuarioId: string) {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);

    const receitas = await TransacaoRepository.filtrar({
      usuarioId,
      tipo: "receita",
      status: StatusTransacao.concluida,
      dataInicio: inicioMes,
      dataFim: fimMes,
    });

    if (!receitas.length) {
      await EnviadorWhatsApp.enviar(
        telefone,
        "📈 Você ainda não tem receitas registradas neste mês."
      );
      return;
    }

    const formatar = (valor: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      }).format(valor);

    const total = receitas.reduce(
      (acc, r) => acc + Number(r.valor),
      0
    );

    const recentes = receitas.slice(0, 15);

    const linhas = recentes.map((r) => {
      const data = r.data
        ? new Date(r.data).toLocaleDateString("pt-BR")
        : "-";
      const desc = r.descricao ?? "Sem descrição";
      return `• ${data} - ${desc}: ${formatar(Number(r.valor))}`;
    });

    const mensagem =
      "📈 *Receitas deste mês*\n\n" +
      linhas.join("\n") +
      `\n\n💰 *Total de receitas no mês:* ${formatar(total)}\n` +
      "_(mostrando as 15 mais recentes)_";

    await EnviadorWhatsApp.enviar(telefone, mensagem);
  }
}
