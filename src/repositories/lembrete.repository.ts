import { Lembrete, Prisma } from "@prisma/client";
import { prisma } from "../infra/prisma";

type CriarLembreteInput = {
  usuarioId: string;
  mensagem: string;
  valor?: number | null;
  dataAlvo: Date; // obrigatório
};

export class LembreteRepository {
  static async criar(dados: CriarLembreteInput): Promise<Lembrete> {
    const data: Prisma.LembreteUncheckedCreateInput = {
      usuarioId: dados.usuarioId,
      mensagem: dados.mensagem,
      valor: dados.valor ?? null,
      enviado: false,
      dataAlvo: dados.dataAlvo, // sempre válido
    };

    return prisma.lembrete.create({ data });
  }

  static async buscarPorId(id: string): Promise<Lembrete | null> {
    return prisma.lembrete.findUnique({
      where: { id },
    });
  }

  static async listarPorUsuario(usuarioId: string): Promise<Lembrete[]> {
    return prisma.lembrete.findMany({
      where: { usuarioId },
      orderBy: { dataAlvo: "asc" },
    });
  }

  static async listarFuturos(usuarioId: string): Promise<Lembrete[]> {
    return prisma.lembrete.findMany({
      where: {
        usuarioId,
        enviado: false,
        dataAlvo: { gte: new Date() },
      },
      orderBy: { dataAlvo: "asc" },
    });
  }

  static async listarPorPeriodo(
    usuarioId: string,
    inicio: Date,
    fim: Date
  ): Promise<Lembrete[]> {
    return prisma.lembrete.findMany({
      where: {
        usuarioId,
        dataAlvo: {
          gte: inicio,
          lt: fim,
        },
      },
      orderBy: { dataAlvo: "asc" },
    });
  }

  static async buscarPorTextoEData(
    usuarioId: string,
    texto: string,
    data: Date
  ): Promise<Lembrete[]> {
    const todos = await prisma.lembrete.findMany({
      where: {
        usuarioId,
        dataAlvo: data,
      },
    });

    const t = texto.toLowerCase();
    return todos.filter((l) => l.mensagem.toLowerCase().includes(t));
  }

  static async buscarSemData(
    usuarioId: string,
    texto: string
  ): Promise<Lembrete[]> {
    const todos = await prisma.lembrete.findMany({
      where: { usuarioId },
    });

    const t = texto.toLowerCase();
    return todos.filter((l) => l.mensagem.toLowerCase().includes(t));
  }

  static async marcarComoEnviado(id: string): Promise<Lembrete> {
    return prisma.lembrete.update({
      where: { id },
      data: { enviado: true },
    });
  }

  static async atualizar(
    id: string,
    dados: Prisma.LembreteUncheckedUpdateInput
  ): Promise<Lembrete> {
    return prisma.lembrete.update({
      where: { id },
      data: dados,
    });
  }

  static async deletar(id: string): Promise<Lembrete> {
    return prisma.lembrete.delete({ where: { id } });
  }
}
