import { Frequencia, RegraMensal, TipoTransacao } from "@prisma/client";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";
import { prisma } from "../../infra/prisma";
import { ContextoRepository } from "../../repositories/contexto.repository";
import { calcularProximaCobranca } from "../../utils/recorrencia";

function normalizar(txt: string) {
  return txt
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function ehSim(txt: string) {
  const t = normalizar(txt);
  return ["sim", "s", "confirmo", "pode", "ok", "fechado", "isso"].includes(t);
}

function ehNao(txt: string) {
  const t = normalizar(txt);
  return ["nao", "não", "n", "cancela", "cancelar", "negativo"].includes(t);
}

function formatarDinheiro(valor: number) {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export class RecorrenciaHandler {
  /**
   * 1) Inicia o fluxo (salva no contexto e pede confirmação)
   */
  static async iniciarCriacao(
    telefone: string,
    usuarioId: string,
    descricao: string | null,
    valor: number | null,
    frequencia: Frequencia | null,

    // ✅ novos campos
    tipo: TipoTransacao | null,
    regraMensal: RegraMensal | null,
    diaDoMes: number | string | null,
    nDiaUtil: number | string | null
  ) {
    if (!descricao) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Não entendi o que você quer tornar recorrente. Ex:\n" +
          "• “pagar academia todo mês dia 10 130”\n" +
          "• “recebo salário todo mês dia 1 3200”"
      );
    }

    if (!frequencia) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Não consegui identificar a frequência (mensal, diária, semanal...)."
      );
    }

    // ✅ tipo default: se não vier, assume despesa (mantém compatível com seu fluxo atual)
    const tipoFinal: TipoTransacao = tipo ?? "despesa";

    // ✅ valor obrigatório (pra recorrência fazer sentido)
    if (valor === null || Number.isNaN(Number(valor))) {
      return EnviadorWhatsApp.enviar(
        telefone,
        `💰 Qual o valor dessa ${tipoFinal === "receita" ? "receita" : "despesa"} recorrente? Ex: “3200”`
      );
    }

    // ✅ validações mensais (dia fixo OU n-ésimo dia útil)
    let regraFinal: RegraMensal | null = regraMensal ?? null;
    let diaFinal: number | null = null;
    let nDiaFinal: number | null = null;

    if (frequencia === "mensal") {
      // Se veio "nDiaUtil", força regra N_DIA_UTIL
      if (nDiaUtil !== null && nDiaUtil !== undefined) {
        regraFinal = "N_DIA_UTIL";
      }

      if (!regraFinal) {
        // se não veio regra, tenta inferir por diaDoMes
        regraFinal = diaDoMes ? "DIA_DO_MES" : null;
      }

      if (regraFinal === "DIA_DO_MES") {
        diaFinal = diaDoMes ? Number(diaDoMes) : null;
        if (!diaFinal || diaFinal < 1 || diaFinal > 31) {
          return EnviadorWhatsApp.enviar(
            telefone,
            "📅 Qual dia do mês? (1 a 31). Ex: “todo dia 10 do mês” ou “todo mês dia 1”"
          );
        }
      }

      if (regraFinal === "N_DIA_UTIL") {
        nDiaFinal = nDiaUtil ? Number(nDiaUtil) : null;
        if (!nDiaFinal || nDiaFinal < 1 || nDiaFinal > 23) {
          return EnviadorWhatsApp.enviar(
            telefone,
            "📅 Qual dia útil do mês? Ex: “5º dia útil” (use um número de 1 a 23)"
          );
        }
      }

      // Se mesmo assim não deu pra determinar, pergunta
      if (!regraFinal) {
        return EnviadorWhatsApp.enviar(
          telefone,
          "📅 Essa recorrência mensal é em *dia fixo* ou *dia útil*?\n\n" +
            "Responda:\n" +
            "• “dia 1” (fixo)\n" +
            "• “5º dia útil”"
        );
      }
    }

    // calcula próxima cobrança
    const proximaCobra = calcularProximaCobranca({
      frequencia,
      regraMensal: regraFinal,
      diaDoMes: diaFinal,
      nDiaUtil: nDiaFinal,
      intervalo: 1,
      base: new Date(),
    });

    // salva pendência no contexto
    await ContextoRepository.definir(telefone, "confirmar_criar_recorrencia", {
      descricao,
      valor: Number(valor),
      frequencia,
      tipo: tipoFinal,
      regraMensal: regraFinal,
      diaDoMes: diaFinal,
      nDiaUtil: nDiaFinal,
      proximaCobra: proximaCobra.toISOString(),
    });

    const titulo = tipoFinal === "receita" ? "receita" : "despesa";
    const regraTxt =
      frequencia !== "mensal"
        ? ""
        : regraFinal === "N_DIA_UTIL"
        ? ` (no ${nDiaFinal}º dia útil)`
        : ` (dia ${diaFinal})`;

    const resumo =
      `Beleza. Vou criar essa recorrência de *${titulo}*:\n\n` +
      `📌 *${descricao}*\n` +
      `💰 *R$ ${formatarDinheiro(Number(valor))}*\n` +
      `⏳ *${frequencia.toUpperCase()}*${regraTxt}\n` +
      `📆 Próxima cobrança: *${this.formatar(proximaCobra)}*\n\n` +
      `Confirma? (Sim/Não)`;

    return EnviadorWhatsApp.enviar(telefone, resumo);
  }

  /**
   * 2) Confirmação (Sim/Não) usando etapa do Contexto
   */
  static async confirmarCriacao(
    telefone: string,
    usuarioId: string,
    mensagem: string,
    dados: Record<string, any>
  ) {
    if (ehNao(mensagem)) {
      await ContextoRepository.limpar(telefone);
      return EnviadorWhatsApp.enviar(telefone, "Tranquilo — cancelei a criação da recorrência ✅");
    }

    if (!ehSim(mensagem)) {
      return EnviadorWhatsApp.enviar(telefone, "Só pra confirmar: responde com *Sim* ou *Não* 🙂");
    }

    await ContextoRepository.limpar(telefone);

    const descricao = (dados?.descricao as string) ?? null;
    const valor = Number(dados?.valor ?? 0);
    const frequencia = (dados?.frequencia as Frequencia) ?? null;

    const tipo = (dados?.tipo as TipoTransacao) ?? "despesa";
    const regraMensal = (dados?.regraMensal as RegraMensal) ?? null;
    const diaDoMes = (dados?.diaDoMes as number) ?? null;
    const nDiaUtil = (dados?.nDiaUtil as number) ?? null;

    return this.criar(telefone, usuarioId, {
      descricao,
      valor,
      frequencia,
      tipo,
      regraMensal,
      diaDoMes,
      nDiaUtil,
    });
  }

  /**
   * 3) Criação real da recorrência (após confirmação)
   */
  static async criar(
    telefone: string,
    usuarioId: string,
    params: {
      descricao: string | null;
      valor: number;
      frequencia: Frequencia | null;
      tipo: TipoTransacao;
      regraMensal: RegraMensal | null;
      diaDoMes: number | null;
      nDiaUtil: number | null;
    }
  ) {
    const { descricao, valor, frequencia, tipo, regraMensal, diaDoMes, nDiaUtil } = params;

    if (!descricao) {
      return EnviadorWhatsApp.enviar(telefone, "❌ Não entendi o que você quer tornar recorrente.");
    }

    if (!frequencia) {
      return EnviadorWhatsApp.enviar(telefone, "❌ Não consegui identificar a frequência.");
    }

    const proximaCobranca = calcularProximaCobranca({
      frequencia,
      regraMensal,
      diaDoMes,
      nDiaUtil,
      intervalo: 1,
      base: new Date(),
    });

    // Transação base (modelo da recorrência)
    const transacao = await prisma.transacao.create({
      data: {
        usuarioId,
        descricao,
        valor,
        tipo, // ✅ agora pode ser receita OU despesa
        data: new Date(),
        dataAgendada: proximaCobranca,
        recorrente: true,
        status: "pendente",
      },
    });

    await prisma.recorrencia.create({
      data: {
        usuarioId,
        transacaoId: transacao.id,
        frequencia,
        intervalo: 1,
        proximaCobra: proximaCobranca,
        regraMensal,
        diaDoMes,
        nDiaUtil,
      },
    });

    const titulo = tipo === "receita" ? "receita" : "despesa";
    const regraTxt =
      frequencia !== "mensal"
        ? ""
        : regraMensal === "N_DIA_UTIL"
        ? ` (no ${nDiaUtil}º dia útil)`
        : ` (dia ${diaDoMes})`;

    return EnviadorWhatsApp.enviar(
      telefone,
      `🔁 Recorrência criada!\n\n` +
        `📌 *${descricao}*\n` +
        `📌 Tipo: *${titulo}*\n` +
        `💰 Valor: *R$ ${formatarDinheiro(valor)}*\n` +
        `⏳ Frequência: *${frequencia.toUpperCase()}*${regraTxt}\n` +
        `📆 Próxima cobrança: *${this.formatar(proximaCobranca)}*\n\n` 
    );
  }

  static formatar(data: Date): string {
    return data.toLocaleDateString("pt-BR");
  }
}
