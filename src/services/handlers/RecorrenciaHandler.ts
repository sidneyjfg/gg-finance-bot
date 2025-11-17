// src/services/handlers/RecorrenciaHandler.ts

import { Recorrencia, Frequencia } from "@prisma/client";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class RecorrenciaHandler {

  /**
   * Criar uma recorrência
   */
  static async criar(
    telefone: string,
    usuarioId: string,
    descricao: string | null,
    valor: number | null,
    frequencia: Frequencia | null,
    diaDoMes: string | number | null // se mensal
  ) {
    // 🚨 Validações mínimas
    if (!descricao) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Não entendi o que você quer tornar recorrente. Pode repetir?"
      );
    }

    if (!frequencia) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Não consegui identificar a frequência (mensal, diária, semanal...)."
      );
    }

    // Valor opcional → transações podem não ter valor ainda
    const valorFinal = valor ?? 0;

    // 📅 Calcular próxima cobrança
    const proximaCobranca = this.calcularProximaCobranca(frequencia, diaDoMes);

    // 1️⃣ Criar a transação base
    const transacao = await prisma.transacao.create({
      data: {
        usuarioId,
        descricao,
        valor: valorFinal,
        tipo: "despesa",
        data: proximaCobranca,
        recorrente: true
      }
    });

    // 2️⃣ Criar a recorrência vinculada
    const recorrencia = await prisma.recorrencia.create({
      data: {
        usuarioId,
        transacaoId: transacao.id,
        frequencia,
        intervalo: 1,
        proximaCobra: proximaCobranca
      }
    });

    // 3️⃣ Enviar confirmação ao usuário
    return EnviadorWhatsApp.enviar(
      telefone,
      `🔁 Recorrência criada!\n\n` +
      `📌 *${descricao}*\n` +
      (valor !== null ? `💰 Valor: R$ ${valor}\n` : "") +
      `⏳ Frequência: *${frequencia.toUpperCase()}*\n` +
      `📆 Próxima cobrança: *${this.formatar(proximaCobranca)}*`
    );
  }

  /**
   * Calcula a próxima data de cobrança
   */
  static calcularProximaCobranca(
    frequencia: Frequencia,
    diaDoMes: string | number | null
  ): Date {
    const hoje = new Date();

    switch (frequencia) {
      case "diaria":
        return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);

      case "semanal":
        return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7);

      case "mensal":
        const dia = diaDoMes ? Number(diaDoMes) : hoje.getDate();
        const mes = hoje.getMonth() + 1;
        let ano = hoje.getFullYear();

        // Se já passou do dia neste mês → próximo mês
        if (dia <= hoje.getDate()) {
          if (mes === 11) {
            ano++;
          }
        }

        return new Date(ano, mes, dia);

      case "anual":
        return new Date(hoje.getFullYear() + 1, hoje.getMonth(), hoje.getDate());
    }
  }

  /**
   * Formata data no padrão brasileiro
   */
  static formatar(data: Date): string {
    return data.toLocaleDateString("pt-BR");
  }
}
