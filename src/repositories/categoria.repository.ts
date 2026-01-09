import { Prisma, Categoria, TipoTransacao } from "@prisma/client";
import { prisma } from "../infra/prisma";

type CriarCategoriaInput = {
  usuarioId: string;
  nome: string;
  tipo: TipoTransacao;
  icone?: string | null;
  cor?: string | null;
};

export class CategoriaRepository {
  static async criar(dados: CriarCategoriaInput): Promise<Categoria> {
    const data: Prisma.CategoriaUncheckedCreateInput = {
      usuarioId: dados.usuarioId,
      nome: dados.nome,
      tipo: dados.tipo,
      icone: dados.icone ?? null,
      cor: dados.cor ?? null,
    };

    return prisma.categoria.create({ data });
  }

  static async buscarPorNome(
    usuarioId: string,
    nome: string
  ): Promise<Categoria | null> {
    const nomeNormalizado = nome.trim().toLowerCase();

    const categorias = await prisma.categoria.findMany({
      where: { usuarioId },
    });

    return (  
      categorias.find(
        (c) => c.nome.trim().toLowerCase() === nomeNormalizado
      ) ?? null
    );
  }

  static async buscarPorId(id: string): Promise<Categoria | null> {
    return prisma.categoria.findUnique({ where: { id } });
  }

  static async listarDoUsuario(usuarioId: string): Promise<Categoria[]> {
    return prisma.categoria.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: "desc" },
    });
  }

  static async deletar(id: string): Promise<Categoria> {
    return prisma.categoria.delete({ where: { id } });
  }

  static async atualizar(
    id: string,
    dados: Prisma.CategoriaUncheckedUpdateInput
  ): Promise<Categoria> {
    return prisma.categoria.update({
      where: { id },
      data: dados,
    });
  }
}
