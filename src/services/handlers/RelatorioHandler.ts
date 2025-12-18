// services/handlers/RelatorioHandler.ts
import { TransacaoRepository } from "../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";
import { LembreteRepository } from "../../repositories/lembrete.repository";
import { LembreteClassifier } from "../../utils/LembreteClassifier";

export class RelatorioHandler {

  static formatar(valor: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(valor);
  }

  static async executar(telefone: string, usuarioId: string) {
    const { receitas, despesas, saldo } = await TransacaoRepository.extrato(usuarioId);

    // 📌 Buscar lembretes futuros com data > hoje
    const lembretes = await LembreteRepository.listarPorUsuario(usuarioId);
    const hoje = new Date();

    const futuros = lembretes.filter(l => l.dataAlvo && l.dataAlvo > hoje);

    // Agrupamento
    const futurasReceitas: any[] = [];
    const futurasDespesas: any[] = [];

    for (const l of futuros) {
      const tipo = LembreteClassifier.classificar(l.mensagem);

      const item = {
        data: l.dataAlvo!,
        mensagem: l.mensagem,
        valor: l.valor ?? 0
      };

      if (tipo === "receita") futurasReceitas.push(item);
      else futurasDespesas.push(item);
    }

    const totalReceitasFuturas = futurasReceitas.reduce((s, x) => s + x.valor, 0);
    const totalDespesasFuturas = futurasDespesas.reduce((s, x) => s + x.valor, 0);

    // 📌 Relatório base
    let texto = `
📊 *RELATÓRIO FINANCEIRO*

💰 Receitas:  ${this.formatar(receitas)}
💸 Despesas:  ${this.formatar(despesas)}
📍 Saldo:     ${this.formatar(saldo)}
    `.trim();

    // 📅 Lançamentos futuros
    texto += `\n\n📅 *PRÓXIMOS LANÇAMENTOS*`;

    // ---------- DESPESAS FUTURAS ----------
    texto += `\n\n🔻 *Despesas futuras:*`;
    if (futurasDespesas.length === 0) {
      texto += `\n• Nenhuma despesa futura`;
    } else {
      futurasDespesas.forEach(d => {
        texto += `\n• ${d.data.toLocaleDateString("pt-BR")} — ${d.mensagem}`;        
        if (d.valor > 0) texto += ` (${this.formatar(d.valor)})`;
      });
      texto += `\n→ *Total de despesas futuras:* ${this.formatar(totalDespesasFuturas)}`;
    }

    // ---------- RECEITAS FUTURAS ----------
    texto += `\n\n🔺 *Receitas futuras:*`;
    if (futurasReceitas.length === 0) {
      texto += `\n• Nenhuma receita futura`;
    } else {
      futurasReceitas.forEach(r => {
        texto += `\n• ${r.data.toLocaleDateString("pt-BR")} — ${r.mensagem}`;
        if (r.valor > 0) texto += ` (${this.formatar(r.valor)})`;
      });
      texto += `\n→ *Total de receitas futuras:* ${this.formatar(totalReceitasFuturas)}`;
    }

    texto += `\n\n🧾 Continue registrando para acompanhar sua saúde financeira!`;

    await EnviadorWhatsApp.enviar(telefone, texto);
  }
}