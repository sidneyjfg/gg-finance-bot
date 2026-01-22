import { LembreteRepository } from "../../../repositories/lembrete.repository";
import { intervaloMes } from "../../../utils/periodo";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";

type ListarLembretesArgs = {
  porMes?: boolean;   // ✅ "passa como argumento se ele quer ver por mes ou so lista"
  mes?: number;       // só usado quando porMes = true (ou assume mês atual)
  ano?: number;       // só usado quando porMes = true (ou assume mês atual)
  limite?: number;    // default 20
};

export class ListarLembretesHandler {
  private static readonly LIMITE_PADRAO = 20;

  private static formatarValor(valor: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    }).format(valor);
  }

  private static obterMesAnoAtual() {
    const hoje = new Date();
    return { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() };
  }

  static async executar(
    telefone: string,
    usuarioId: string,
    args?: ListarLembretesArgs
  ) {
    try {
      const porMes = args?.porMes ?? false;
      const limite = args?.limite ?? this.LIMITE_PADRAO;

      let lembretes: any[] = [];
      let titulo = "";

      // ✅ IF principal do "modo" (é isso que teu gestor quer)
      if (porMes) {
        // se pediu por mês mas não veio mês/ano, assume mês atual
        const alvo =
          args?.mes && args?.ano
            ? { mes: args.mes, ano: args.ano }
            : this.obterMesAnoAtual();

        const { inicio, fim } = intervaloMes(alvo.mes, alvo.ano);

        lembretes =
          (await LembreteRepository.listarPorPeriodo(usuarioId, inicio, fim)) ?? [];

        const mesFmt = String(alvo.mes).padStart(2, "0");
        titulo = `📋 *Lembretes de ${mesFmt}/${alvo.ano}*`;
      } else {
        // ✅ modo "só lista"
        lembretes = (await LembreteRepository.listarFuturos(usuarioId)) ?? [];
        titulo = "📋 *Seus lembretes futuros*";
      }

      // ✅ limite padrão
      if (Array.isArray(lembretes) && limite > 0) {
        lembretes = lembretes.slice(0, limite);
      }

      if (!Array.isArray(lembretes) || lembretes.length === 0) {
        await EnviadorWhatsApp.enviar(
          telefone,
          porMes
            ? "⚠️ Você não tem lembretes para esse mês."
            : "⚠️ Você não tem lembretes futuros."
        );
        return;
      }

      const linhas = lembretes.map((l, idx) => {
        const data = l.dataAlvo
          ? new Date(l.dataAlvo).toLocaleDateString("pt-BR")
          : "-";

        const numValor = l.valor != null ? Number(l.valor) : null;
        const valor =
          numValor != null && !Number.isNaN(numValor)
            ? ` (${this.formatarValor(numValor)})`
            : "";

        return `${idx + 1}) ${data} - ${l.mensagem}${valor}`;
      });

      const mensagem = `${titulo}\n\n${linhas.join("\n")}`;
      await EnviadorWhatsApp.enviar(telefone, mensagem);
    } catch (err: any) {
      console.error("[ListarLembretes] ERRO REAL:", err?.message);
      console.error(err?.stack ?? err);

      await EnviadorWhatsApp.enviar(
        telefone,
        "❌ Ocorreu um erro ao listar seus lembretes. (erro interno registrado)"
      );
    }
  }
}
