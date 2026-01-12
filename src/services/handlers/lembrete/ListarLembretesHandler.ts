import { LembreteRepository } from "../../../repositories/lembrete.repository";
import { intervaloMes } from "../../../utils/periodo";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";


export class ListarLembretesHandler {
  private static formatarValor(valor: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    }).format(valor);
  }

  static async executar(
    telefone: string,
    usuarioId: string,
    mes?: number,
    ano?: number
  ) {
    let lembretes;
    let titulo: string;

    if (mes && ano) {
      const { inicio, fim } = intervaloMes(mes, ano);
      lembretes = await LembreteRepository.listarPorPeriodo(usuarioId, inicio, fim);
      const mesFmt = String(mes).padStart(2, "0");
      titulo = `📋 *Lembretes de ${mesFmt}/${ano}*`;
    } else {
      lembretes = await LembreteRepository.listarFuturos(usuarioId);
      titulo = "📋 *Seus lembretes futuros*";
    }

    if (!lembretes.length) {
      const msgVazio =
        mes && ano
          ? "⚠️ Você não tem lembretes para esse mês."
          : "⚠️ Você não tem lembretes futuros.";
      await EnviadorWhatsApp.enviar(telefone, msgVazio);
      return;
    }

    const linhas = lembretes.map((l, idx) => {
      const data = l.dataAlvo
        ? new Date(l.dataAlvo).toLocaleDateString("pt-BR")
        : "-";
      const valor = l.valor ? ` (${this.formatarValor(Number(l.valor))})` : "";
      return `${idx + 1}) ${data} - ${l.mensagem}${valor}`;
    });

    const mensagem = `${titulo}\n\n${linhas.join("\n")}`;
    await EnviadorWhatsApp.enviar(telefone, mensagem);
  }
}
