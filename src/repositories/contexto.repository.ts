import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export class ContextoRepository {

  // Obter contexto já parseado
  static async obter(telefone: string) {
    const ctx = await prisma.contexto.findUnique({
      where: { telefone }
    });

    if (!ctx) return null;

    return {
      telefone: ctx.telefone,
      etapa: ctx.etapa,
      dados: ctx.dados ? JSON.parse(ctx.dados) : {},
      criadoEm: ctx.criadoEm
    };
  }

  // Salvar contexto COMPLETO (overwrite)
  static async salvar(
    telefone: string,
    contexto: { etapa: string; dados?: any }
  ) {

    return prisma.contexto.upsert({
      where: { telefone },
      create: {
        telefone,
        etapa: contexto.etapa,
        dados: JSON.stringify(contexto.dados ?? {})
      },
      update: {
        etapa: contexto.etapa,
        dados: JSON.stringify(contexto.dados ?? {})
      }
    });
  }

  // Define etapa e dados (corrigido)
  static async definir(telefone: string, etapa: string, dados: any = {}) {
    return this.salvar(telefone, { etapa, dados });
  }

  // Apenas mescla os dados
  static async atualizarDados(telefone: string, novosDados: any) {
    const existing = await this.obter(telefone);
    const merged = { ...(existing?.dados || {}), ...novosDados };

    return prisma.contexto.update({
      where: { telefone },
      data: { dados: JSON.stringify(merged) }
    });
  }

  // Atualiza apenas etapa
  static async atualizarEtapa(telefone: string, etapa: string) {
    return prisma.contexto.update({
      where: { telefone },
      data: { etapa }
    });
  }

  // Atualiza etapa e dados atômicos (merge)
  static async avancar(telefone: string, etapa: string, novosDados: any = {}) {
    const existing = await this.obter(telefone);
    const dados = existing?.dados || {};

    return prisma.contexto.upsert({
      where: { telefone },
      create: {
        telefone,
        etapa,
        dados: JSON.stringify({ ...dados, ...novosDados })
      },
      update: {
        etapa,
        dados: JSON.stringify({ ...dados, ...novosDados })
      }
    });
  }

  // Atualiza tudo (overwrite completo)
  static async atualizar(telefone: string, etapa: string, dados: any) {
    return prisma.contexto.update({
      where: { telefone },
      data: {
        etapa,
        dados: JSON.stringify(dados)
      }
    });
  }

  // Limpa o contexto
  static async limpar(telefone: string) {
    return prisma.contexto
      .delete({ where: { telefone } })
      .catch(() => null);
  }
}
