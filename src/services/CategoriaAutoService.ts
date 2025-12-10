// services/CategoriaAutoService.ts
import { Categoria, TipoTransacao } from "@prisma/client";
import { CategoriaRepository } from "../repositories/categoria.repository";
import { inferirCategoriaPadrao } from "../utils/categoriaNormalizada";

export class CategoriaAutoService {
  static async resolver(
    usuarioId: string,
    nomeIA: string | null,
    tipo: TipoTransacao,       // "receita" | "despesa"
    descricao?: string | null
  ): Promise<Categoria> {
    // 1) Tenta inferir categoria genérica (Streaming, Transporte, etc.)
    const categoriaGenerica = inferirCategoriaPadrao(
      tipo === "receita" ? "receita" : "despesa",
      descricao,
      nomeIA
    );

    let nomeFinal: string | null = categoriaGenerica ?? nomeIA;

    // 2) Se nada veio, categoria padrão por tipo
    if (!nomeFinal || nomeFinal.trim().length === 0) {
      nomeFinal = tipo === "receita" ? "Outras receitas" : "Outras despesas";
    }

    const nomeNormalizado = nomeFinal.trim();

    const categoriaExistente = await CategoriaRepository.buscarPorNome(
      usuarioId,
      nomeNormalizado
    );

    if (categoriaExistente) {
      return categoriaExistente;
    }

    const nova = await CategoriaRepository.criar({
      usuarioId,
      nome: nomeNormalizado,
      tipo,
    });

    return nova;
  }
}
