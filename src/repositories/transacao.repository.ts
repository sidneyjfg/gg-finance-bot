import {
  Prisma,
  Transacao,
  TipoTransacao,
  StatusTransacao,
  Categoria
} from "@prisma/client";
import { prisma } from "../infra/prisma";
import { CategoriaRepository } from "./categoria.repository";

type GastoPorCategoriaItem = {
  categoriaId: string | null;
  nome: string;
  total: number;
};

type TransacaoComCategoria = Transacao & {
  categoria: Categoria | null;
};

export class TransacaoRepository {
  // Criar transação usando o tipo unchecked (campos escalares)
  static async criar(
    dados: Omit<Prisma.TransacaoUncheckedCreateInput, "id" | "criadoEm"> & {
      data?: Date;
    }
  ): Promise<Transacao> {
    return prisma.transacao.create({
      data: {
        usuarioId: dados.usuarioId,
        categoriaId: dados.categoriaId ?? null,
        tipo: dados.tipo,
        valor: dados.valor,
        descricao: (dados as any).descricao ?? null,
        data: dados.data ?? new Date(),
        dataAgendada: dados.dataAgendada ?? null,
        status: dados.status ?? "concluida",
        recorrente: dados.recorrente ?? false,
      },
    });
  }

  static async buscarPorId(id: string): Promise<Transacao | null> {
    return prisma.transacao.findUnique({
      where: { id },
    });
  }

  static async listarRecentes(usuarioId: string): Promise<Transacao[]> {
    return prisma.transacao.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: "desc" },
      take: 10,
    });
  }

  static async listarPorUsuario(usuarioId: string): Promise<Transacao[]> {
    return prisma.transacao.findMany({
      where: { usuarioId },
      orderBy: { data: "desc" },
    });
  }

  static async listarPorTipo(
    usuarioId: string,
    tipo: TipoTransacao
  ): Promise<Transacao[]> {
    return prisma.transacao.findMany({
      where: { usuarioId, tipo },
      orderBy: { data: "desc" },
    });
  }

  static async listarDetalhadoPorTipo(
    usuarioId: string,
    tipo: TipoTransacao
  ): Promise<TransacaoComCategoria[]> {
    return prisma.transacao.findMany({
      where: {
        usuarioId,
        tipo
      },
      orderBy: { data: "desc" },
      include: {
        categoria: true
      }
    });
  }

  static async filtrar(params: {
    usuarioId: string;
    tipo?: TipoTransacao;
    categoriaId?: string;
    status?: StatusTransacao;
    dataInicio?: Date;
    dataFim?: Date;
  }): Promise<Transacao[]> {
    return prisma.transacao.findMany({
      where: {
        usuarioId: params.usuarioId,
        tipo: params.tipo,
        categoriaId: params.categoriaId,
        status: params.status,
        data:
          params.dataInicio && params.dataFim
            ? {
                gte: params.dataInicio,
                lt: params.dataFim, // ✅ fim EXCLUSIVO
              }
            : undefined,
      },
      orderBy: { data: "desc" },
    });
  }

  static async somarPorTipo(
    usuarioId: string,
    tipo: TipoTransacao
  ): Promise<number> {
    const resultado = await prisma.transacao.aggregate({
      where: { usuarioId, tipo },
      _sum: { valor: true },
    });
    return Number(resultado._sum.valor ?? 0);
  }

  static async extrato(usuarioId: string) {
    const receitas = await this.somarPorTipo(usuarioId, "receita");
    const despesas = await this.somarPorTipo(usuarioId, "despesa");
    return {
      receitas,
      despesas,
      saldo: receitas - despesas,
    };
  }

  static async gastosPorCategoria(
    usuarioId: string
  ): Promise<GastoPorCategoriaItem[]> {
    const grupos = await prisma.transacao.groupBy({
      by: ["categoriaId"],
      where: {
        usuarioId,
        tipo: "despesa",
        status: StatusTransacao.concluida,
      },
      _sum: {
        valor: true,
      },
    });

    if (!grupos.length) {
      return [];
    }

    const categoriaIds = grupos
      .map((g) => g.categoriaId)
      .filter((id): id is string => id !== null);

    const categorias =
      categoriaIds.length > 0
        ? await prisma.categoria.findMany({
            where: { id: { in: categoriaIds } },
          })
        : [];

    return grupos
      .map((g) => {
        const total = Number(g._sum.valor ?? 0);

        const categoria =
          g.categoriaId != null
            ? categorias.find((c) => c.id === g.categoriaId)
            : null;

        return {
          categoriaId: g.categoriaId,
          nome: categoria?.nome ?? "Sem categoria",
          total,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  static async listarDespesasPorCategoriaNome(
    usuarioId: string,
    nomeCategoria: string
  ): Promise<Transacao[]> {
    const categoria = await CategoriaRepository.buscarPorNome(
      usuarioId,
      nomeCategoria
    );

    if (!categoria) {
      return [];
    }

    return prisma.transacao.findMany({
      where: {
        usuarioId,
        tipo: "despesa",
        status: StatusTransacao.concluida,
        categoriaId: categoria.id,
      },
      orderBy: { data: "desc" },
    });
  }

  static async atualizar(
    id: string,
    dados: Prisma.TransacaoUncheckedUpdateInput
  ): Promise<Transacao> {
    return prisma.transacao.update({
      where: { id },
      data: dados,
    });
  }

  static async atualizarCategoria(
    id: string,
    categoriaId: string | null
  ): Promise<Transacao> {
    return prisma.transacao.update({
      where: { id },
      data: { categoriaId },
    });
  }

  static async atualizarStatus(
    id: string,
    status: StatusTransacao
  ): Promise<Transacao> {
    return prisma.transacao.update({
      where: { id },
      data: { status },
    });
  }

  static async atualizarDataAgendada(
    id: string,
    dataAgendada: Date | null
  ): Promise<Transacao> {
    return prisma.transacao.update({
      where: { id },
      data: { dataAgendada },
    });
  }

  static async deletar(id: string): Promise<Transacao> {
    return prisma.transacao.delete({ where: { id } });
  }

  static async buscarAgendadasAte(dataLimite: Date): Promise<Transacao[]> {
    return prisma.transacao.findMany({
      where: {
        dataAgendada: {
          lte: dataLimite,
        },
        status: "pendente",
      },
    });
  }
}
