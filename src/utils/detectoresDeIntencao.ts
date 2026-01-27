import { extrairMesEAno } from "../utils/periodo";

export type DetectorContexto = {
  userId: string; // 🔑 identidade do chat
  usuarioId: string;
  mensagem: string;
  mensagemNormalizada: string;
};

export type Detector = {
  nome: string;
  match: (ctx: DetectorContexto) => boolean;
  executar: (ctx: DetectorContexto) => Promise<void>;
};

/**
 * IMPORTANTE:
 * - Ordem importa
 * - Do mais específico → mais genérico
 */
export const detectores: Detector[] = [
  // ===============================
  // 📌 GASTOS POR CATEGORIA (resumo)
  // Ex: "gastos por categoria", "gastos por categoria do mês passado"
  // ===============================
  {
    nome: "gastos_por_categoria",
    match: ({ mensagemNormalizada }) =>
      /\b(gastos?|despesas?)\b/.test(mensagemNormalizada) &&
      /\bpor\s+categori(a|as)\b/.test(mensagemNormalizada),

    executar: async ({ userId, usuarioId, mensagem }) => {
      const mesAno = extrairMesEAno(mensagem); // pode ser null

      const { GastoPorCategoriaHandler } = await require(
        "../services/handlers/relatorios/GastoPorCategoriaHandler"
      );

      await GastoPorCategoriaHandler.executar(
        userId,
        usuarioId,
        mesAno?.mes,
        mesAno?.ano
      );
    },
  },

  {
    nome: "gastos_da_categoria_por_mes",
    match: ({ mensagemNormalizada, mensagem }) =>
      /\b(gastos?|despesas?)\b/.test(mensagemNormalizada) &&
      /\bcategoria\b/.test(mensagemNormalizada) &&
      !!extrairMesEAno(mensagem) &&
      !/\bpor\s+categori(a|as)\b/.test(mensagemNormalizada),

    executar: async ({ userId, usuarioId, mensagem, mensagemNormalizada }) => {
      const mesAno = extrairMesEAno(mensagem)!;

      // pega tudo depois da palavra "categoria"
      const nomeCategoria = mensagemNormalizada
        .split("categoria")
        .slice(1)
        .join("categoria")
        .trim();

      const { GastoDaCategoriaPorMesHandler } = await require(
        "../services/handlers/relatorios/GastoDaCategoriaPorMesHandler"
      );

      await GastoDaCategoriaPorMesHandler.executar(
        userId,
        usuarioId,
        nomeCategoria,
        mesAno.mes,
        mesAno.ano
      );
    },
  },

  // ===============================
  // 📌 GASTOS DA CATEGORIA (geral)
  // Ex: "gastos da categoria moradia"
  // ===============================
  {
    nome: "gastos_da_categoria",
    match: ({ mensagemNormalizada }) =>
      /\b(gastos?|despesas?)\b/.test(mensagemNormalizada) &&
      /\bcategoria\b/.test(mensagemNormalizada) &&
      !/\bpor\s+categori(a|as)\b/.test(mensagemNormalizada),

    executar: async ({ userId, usuarioId, mensagemNormalizada }) => {
      const nomeCategoria = mensagemNormalizada
        .split("categoria")
        .slice(1)
        .join("categoria")
        .trim();

      // ✅ arquivo que você mandou: "GastosDaCategoria.ts"
      // ✅ classe: GastosDaCategoriaHandler
      const { GastosDaCategoriaHandler } = await require(
        "../services/handlers/relatorios/GastosDaCategoriaHandler"
      );

      await GastosDaCategoriaHandler.executar(userId, usuarioId, nomeCategoria);
    },
  },

  // ===============================
  // 📌 LISTAR DESPESAS (Por mês)
  // ===============================
  {
    nome: "despesas_por_mes",
    match: ({ mensagemNormalizada, mensagem }) =>
      /\b(despesa|despesas|gasto|gastos)\b/.test(mensagemNormalizada) &&
      !!extrairMesEAno(mensagem),

    executar: async ({ userId, usuarioId, mensagem }) => {
      const mesAno = extrairMesEAno(mensagem)!;

      const { DespesasPorMesHandler } = await require(
        "../services/handlers/relatorios/DespesasPorMesHandler"
      );

      await DespesasPorMesHandler.executar(userId, usuarioId, {
        mes: mesAno.mes,
        ano: mesAno.ano,
      });
    },
  },

  // ===============================
  // 📌 LISTAR DESPESAS (Geral)
  // (não deve roubar casos com "categoria")
  // ===============================
  {
    nome: "listar_despesas",
    match: ({ mensagemNormalizada }) =>
      /\b(despesas|gastos)\b/.test(mensagemNormalizada) &&
      !/\bcategoria\b/.test(mensagemNormalizada) &&
      /(ver|listar|mostrar|visualizar)?/.test(mensagemNormalizada),

    executar: async ({ userId, usuarioId }) => {
      const { ListarDespesasHandler } = await require(
        "../services/handlers/financeiro/ListarDespesaHandler"
      );

      await ListarDespesasHandler.executar(userId, usuarioId, false);
    },
  },

  // ===============================
  // 📌 LISTAR RECEITAS (Por mês)
  // ===============================
  {
    nome: "receitas_por_mes",
    match: ({ mensagemNormalizada, mensagem }) =>
      /\b(receita|receitas|entrada|entradas)\b/.test(mensagemNormalizada) &&
      !!extrairMesEAno(mensagem),

    executar: async ({ userId, usuarioId, mensagem }) => {
      const mesAno = extrairMesEAno(mensagem)!;

      const { ReceitasPorMesHandler } = await require(
        "../services/handlers/relatorios/ReceitasPorMesHandler"
      );

      await ReceitasPorMesHandler.executar(userId, usuarioId, {
        mes: mesAno.mes,
        ano: mesAno.ano,
      });
    },
  },

  // ===============================
  // 📌 LISTAR RECEITAS (Geral)
  // ===============================
  {
    nome: "listar_receitas",
    match: ({ mensagemNormalizada }) =>
      /\b(receitas|entradas)\b/.test(mensagemNormalizada) &&
      /(ver|listar|mostrar|visualizar)?/.test(mensagemNormalizada),

    executar: async ({ userId, usuarioId }) => {
      const { ListarReceitasHandler } = await require(
        "../services/handlers/financeiro/ListarReceitaHandler"
      );

      await ListarReceitasHandler.executar(userId, usuarioId, false);
    },
  },

  // ===============================
  // 📌 LISTAR LEMBRETES (Por mês)
  // ===============================
  {
    nome: "lembretes_por_mes",
    match: ({ mensagemNormalizada, mensagem }) => {
      const temPalavraLembrete =
        /\b(lembrete|lembretes|avisos|agenda|recordatorio|recordatorios)\b/.test(
          mensagemNormalizada
        );
      const mesAno = extrairMesEAno(mensagem);
      if (!temPalavraLembrete || !mesAno) return false;

      const pediuListagem = /\b(quais|meus|minhas|listar|ver|mostrar|exibir|tem|tenho)\b/.test(
        mensagemNormalizada
      ) ||
        /\b(do|da|de)\s+(mes|m[eê]s|janeliro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/.test(
          mensagemNormalizada
        );
      return pediuListagem;
    },

    executar: async ({ userId, usuarioId, mensagem }) => {
      const mesAno = extrairMesEAno(mensagem)!;

      const { LembretesPorMesHandler } = await require(
        "../services/handlers/relatorios/LembretesPorMesHandler"
      );

      await LembretesPorMesHandler.executar(userId, usuarioId, {
        mes: mesAno.mes,
        ano: mesAno.ano,
      });
    },
  },

  // ===============================
  // 📌 LISTAR LEMBRETES (Geral)
  // ===============================
  {
    nome: "listar_lembretes",
    match: ({ mensagemNormalizada }) =>
      /\b(lembrete|lembretes|avisos|agenda|recordatorio|recordatorios)\b/.test(
        mensagemNormalizada
      ) &&
      /(quais|meus|minhas|listar|ver|mostrar|exibir|tem|tenho)/.test(
        mensagemNormalizada
      ),

    executar: async ({ userId, usuarioId }) => {
      const { ListarLembretesHandler } = await require(
        "../services/handlers/lembrete/ListarLembretesHandler"
      );

      await ListarLembretesHandler.executar(userId, usuarioId);
    },
  },
];
