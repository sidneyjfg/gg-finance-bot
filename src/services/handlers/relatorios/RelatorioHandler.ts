import { prisma } from "../../../infra/prisma";
import { LembreteRepository } from "../../../repositories/lembrete.repository";
import { TransacaoRepository } from "../../../repositories/transacao.repository";
import { LembreteClassifier } from "../../../utils/LembreteClassifier";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";

export class RelatorioHandler {
  static formatar(valor: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  }

  static async executar(telefone: string, usuarioId: string) {
    const { receitas, despesas, saldo } = await TransacaoRepository.extrato(usuarioId);

    const hoje = new Date();

    const lembretes = await LembreteRepository.listarPorUsuario(usuarioId);
    const futurosLembretes = lembretes.filter((l) => l.dataAlvo && l.dataAlvo > hoje);

    const recorrenciasFuturas = await prisma.recorrencia.findMany({
      where: {
        usuarioId,
        proximaCobra: { gt: hoje },
      },
      orderBy: { proximaCobra: "asc" },
      include: {
        transacao: true, // tem descricao, valor, tipo
      },
      take: 10, // evita texto gigante
    });

    type FuturoItem = {
      data: Date;
      mensagem: string;
      valor: number;
      origem: "lembrete" | "recorrencia";
    };

    const futurasReceitas: FuturoItem[] = [];
    const futurasDespesas: FuturoItem[] = [];

    // ---- Lembretes
    for (const l of futurosLembretes) {
      const tipo = LembreteClassifier.classificar(l.mensagem);

      const item: FuturoItem = {
        data: l.dataAlvo!,
        mensagem: l.mensagem,
        valor: l.valor ?? 0,
        origem: "lembrete",
      };

      if (tipo === "receita") futurasReceitas.push(item);
      else futurasDespesas.push(item);
    }

    // ---- Recorrências
    for (const r of recorrenciasFuturas) {
      const tipo = r.transacao?.tipo; // "receita" | "despesa"
      const descricao = r.transacao?.descricao ?? "Recorrência";
      const valor = r.transacao?.valor ? Number(r.transacao.valor) : 0;

      const item: FuturoItem = {
        data: r.proximaCobra,
        mensagem: descricao,
        valor,
        origem: "recorrencia",
      };

      if (tipo === "receita") futurasReceitas.push(item);
      else futurasDespesas.push(item);
    }

    // Ordena por data (misturando lembrete + recorrência)
    futurasReceitas.sort((a, b) => a.data.getTime() - b.data.getTime());
    futurasDespesas.sort((a, b) => a.data.getTime() - b.data.getTime());

    const totalReceitasFuturas = futurasReceitas.reduce((s, x) => s + x.valor, 0);
    const totalDespesasFuturas = futurasDespesas.reduce((s, x) => s + x.valor, 0);

    // =========================================================
    // 4) Texto do relatório (mesmo padrão)
    // =========================================================
    let texto = `
📊 *RELATÓRIO FINANCEIRO*

💰 Receitas:  ${this.formatar(receitas)}
💸 Despesas:  ${this.formatar(despesas)}
📍 Saldo:     ${this.formatar(saldo)}
    `.trim();

    texto += `\n\n📅 *PRÓXIMOS LANÇAMENTOS*`;

    // ---------- DESPESAS FUTURAS ----------
    texto += `\n\n🔻 *Despesas futuras:*`;
    if (futurasDespesas.length === 0) {
      texto += `\n• Nenhuma despesa futura`;
    } else {
      futurasDespesas.forEach((d) => {
        const dataFmt = d.data.toLocaleDateString("pt-BR");

        // opcional: mostrar origem
        // const tag = d.origem === "recorrencia" ? " (recorrência)" : "";
        // texto += `\n• ${dataFmt} — ${d.mensagem}${tag}`;

        texto += `\n• ${dataFmt} — ${d.mensagem}`;

        if (d.valor > 0) texto += ` (${this.formatar(d.valor)})`;
      });

      texto += `\n→ *Total de despesas futuras:* ${this.formatar(totalDespesasFuturas)}`;
    }

    // ---------- RECEITAS FUTURAS ----------
    texto += `\n\n🔺 *Receitas futuras:*`;
    if (futurasReceitas.length === 0) {
      texto += `\n• Nenhuma receita futura`;
    } else {
      futurasReceitas.forEach((r) => {
        const dataFmt = r.data.toLocaleDateString("pt-BR");

        // opcional: mostrar origem
        // const tag = r.origem === "recorrencia" ? " (recorrência)" : "";
        // texto += `\n• ${dataFmt} — ${r.mensagem}${tag}`;

        texto += `\n• ${dataFmt} — ${r.mensagem}`;

        if (r.valor > 0) texto += ` (${this.formatar(r.valor)})`;
      });

      texto += `\n→ *Total de receitas futuras:* ${this.formatar(totalReceitasFuturas)}`;
    }

    texto += `\n\n🧾 Continue registrando para acompanhar sua saúde financeira!`;

    await EnviadorWhatsApp.enviar(telefone, texto);
  }
}
