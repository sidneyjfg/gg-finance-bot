import { TransacaoRepository } from "../../../repositories/transacao.repository";
import { intervaloMes } from "../../../utils/periodo";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";

export class GastoPorCategoriaHandler {
  static async executar(
    telefone: string,
    usuarioId: string,
    mes?: number, // 1..12
    ano?: number
  ) {
    const usandoPeriodo = !!mes && !!ano;

    const resultados = usandoPeriodo
      ? await (async () => {
          const { inicio, fim } = intervaloMes(mes!, ano!);
          return TransacaoRepository.gastosPorCategoriaPorPeriodo(usuarioId, inicio, fim);
        })()
      : await TransacaoRepository.gastosPorCategoria(usuarioId);

    if (!resultados.length) {
      const msgPeriodo = usandoPeriodo
        ? `para ${String(mes).padStart(2, "0")}/${ano}`
        : "para calcular por categoria";

      await EnviadorWhatsApp.enviar(
        telefone,
        `📊 Ainda não encontrei despesas concluídas ${msgPeriodo}.\n` +
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

    const linhas = resultados.map((r) => `• *${r.nome}*: ${formatar(r.total)}`);

    const totalGeral = resultados.reduce((acc, r) => acc + r.total, 0);

    const titulo = usandoPeriodo
      ? `📊 *Gastos por categoria — ${String(mes!).padStart(2, "0")}/${ano}*`
      : "📊 *Resumo de gastos por categoria*";

    const mensagem =
      `${titulo}\n\n` +
      linhas.join("\n") +
      `\n\n💰 *Total gasto:* ${formatar(totalGeral)}\n` +
      "_(considerando apenas despesas marcadas como concluídas)_";

    await EnviadorWhatsApp.enviar(telefone, mensagem);
  }
}
