// assistenteFinanceiro.ts
import { InterpretadorGemini } from "../ia/interpretadorGemini";
import { RespostaGemini } from "../ia/respostaGemini";

import { RegistrarDespesaHandler } from "../services/handlers/financeiro/RegistrarDespesaHandler";
import { RegistrarReceitaHandler } from "../services/handlers/financeiro/RegistrarReceitaHandler";
import { LembreteHandler } from "../services/handlers/lembrete/LembreteHandler";
import { AgendamentoHandler } from "../services/handlers/AgendamentoHandler";
import { EditarTransacaoHandler } from "../services/handlers/financeiro/EditarTransacaoHandler";

import { PerfilHandler } from "../services/handlers/PerfilHandler";
import { CadastroUsuarioHandler } from "../services/handlers/CadastroUsuarioHandler";

import { UsuarioRepository } from "../repositories/usuario.repository";
import { ContextoRepository } from "../repositories/contexto.repository";
import { EnviadorWhatsApp } from "../services/EnviadorWhatsApp";
import { ExcluirLembreteHandler } from "../services/handlers/lembrete/ExcluirLembreteHandler";
import { ListarDespesasHandler } from "../services/handlers/financeiro/ListarDespesaHandler";

import { detectores } from "../utils/detectoresDeIntencao";
import { RecorrenciaHandler } from "../services/handlers/financeiro/RecorrenciaHandler";
import { ExcluirTransacaoHandler } from "../services/handlers/financeiro/ExcluirTransacaoHandler";
import { GastoPorCategoriaHandler } from "../services/handlers/relatorios/GastoPorCategoriaHandler";
import { GastosDaCategoriaHandler } from "../services/handlers/relatorios/GastosDaCategoriaHandler";
import { RelatorioHandler } from "../services/handlers/relatorios/RelatorioHandler";
import { CategoriaHandler } from "../services/handlers/financeiro/CategoriaHandler";
import { ListarReceitasHandler } from "../services/handlers/financeiro/ListarReceitaHandler";
import { rateLimitIA } from "../middlewares/rateLimit.middleware";

export class AssistenteFinanceiro {
  static async processar(userId: string, mensagem: string) {
    const usuario = await UsuarioRepository.buscarPorUserId(userId);
    const contexto = await ContextoRepository.obter(userId);

    // 🔧 RESET DE CONTEXTO
    const msgLower = mensagem.trim().toLowerCase();
    if (msgLower === "#reset" || msgLower === "/reset") {
      await ContextoRepository.limpar(userId);
      await EnviadorWhatsApp.enviar(
        userId,
        "🧹 Contexto apagado! Podemos começar do zero."
      );
      return;
    }

    // 0️⃣ SAUDAÇÃO SIMPLES
    if (usuario && !contexto) {
      const ehSaudacao =
        ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"].some(s =>
          msgLower.startsWith(s)
        ) &&
        msgLower.length <= 20 &&
        !/\d/.test(msgLower);

      if (ehSaudacao) {
        await EnviadorWhatsApp.enviar(
          userId,
          `👋 Olá, *${usuario.nome?.split(" ")[0] || "tudo bem"}*! Como posso te ajudar hoje?`
        );
        return;
      }
    }

    // 1️⃣ CONTEXTO ATIVO
    if (contexto) {
      switch (contexto.etapa) {
        case "criando_categoria_nome":
          return CategoriaHandler.salvarNome(userId, mensagem);

        case "criando_categoria_tipo":
          return CategoriaHandler.salvarTipo(userId, mensagem, usuario!.id);

        case "informar_data_agendada":
          return AgendamentoHandler.salvarData(userId, mensagem, usuario!.id);

        case "criando_lembrete_texto":
          return LembreteHandler.salvarTexto(userId, mensagem);

        case "criando_lembrete_data":
          return LembreteHandler.salvarData(userId, mensagem, usuario!.id);

        case "criando_lembrete_valor":
          return LembreteHandler.salvarValor(userId, mensagem, usuario!.id);

        case "complementar_mes_lembrete":
          return LembreteHandler.salvarMes(userId, mensagem, usuario!.id);

        case "editar_transacao_id":
          return EditarTransacaoHandler.selecionar(userId, mensagem);

        case "editar_transacao_opcao":
          if (mensagem.startsWith("1"))
            return EditarTransacaoHandler.editarValor(userId, Number(mensagem));
          if (mensagem.startsWith("2"))
            return EditarTransacaoHandler.editarDescricao(userId, mensagem);
          break;

        case "excluir_transacao_id":
          return ExcluirTransacaoHandler.confirmar(userId, mensagem);

        case "confirmar_exclusao":
          return ExcluirTransacaoHandler.executar(userId, mensagem);

        case "excluir_lembrete_escolher":
          return ExcluirLembreteHandler.escolher(userId, mensagem);

        case "confirmar_exclusao_lembrete":
          return ExcluirLembreteHandler.executar(userId, mensagem);

        case "confirmar_criar_recorrencia":
          return RecorrenciaHandler.confirmarCriacao(
            userId,
            usuario!.id,
            mensagem,
            contexto.dados
          );

        case "informar_valor_recorrencia":
          return RecorrenciaHandler.salvarValor(
            userId,
            usuario!.id,
            mensagem,
            contexto.dados
          );
      }
    }

    // 2️⃣ CADASTRO OBRIGATÓRIO
    if (!usuario) {
      return CadastroUsuarioHandler.executar(userId, mensagem);
    }

    // 3️⃣ DETECTORES
    const mensagemNormalizada = mensagem
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const ctx = {
      userId,
      usuarioId: usuario.id,
      mensagem,
      mensagemNormalizada
    };

    for (const detector of detectores) {
      if (detector.match(ctx)) {
        await detector.executar(ctx);
        return;
      }
    }

    // 🚦 RATE LIMIT
    if (!rateLimitIA(usuario.id)) {
      await EnviadorWhatsApp.enviar(
        userId,
        "⏳ Você está usando rápido demais. Aguarde um pouco antes de tentar novamente."
      );
      return;
    }

    // 4️⃣ IA
    const interpretacao = await InterpretadorGemini.interpretarMensagem(
      mensagem,
      { usuario }
    );
    const intents = Array.isArray(interpretacao)
      ? interpretacao
      : [interpretacao];

    let processou = false;

    for (const intent of intents) {
      switch (intent.acao) {
        case "registrar_despesa":
          processou = true;
          await RegistrarDespesaHandler.executar(
            userId,
            usuario.id,
            intent.valor,
            intent.descricao,
            intent.agendar,
            intent.dataAgendada,
            intent.categoria
          );
          break;

        case "registrar_receita":
          processou = true;
          await RegistrarReceitaHandler.executar(
            userId,
            usuario.id,
            intent.valor,
            intent.descricao,
            intent.dataAgendada,
            intent.categoria
          );
          break;

        case "criar_categoria":
          processou = true;
          await CategoriaHandler.iniciarCriacao(userId);
          break;

        case "criar_lembrete":
          processou = true;
          await LembreteHandler.iniciar(
            userId,
            usuario.id,
            intent.mensagem,
            intent.data,
            intent.valor ?? null,
            mensagem
          );
          break;

        case "criar_recorrencia":
          processou = true;
          await RecorrenciaHandler.iniciarCriacao(
            userId,
            usuario.id,
            intent.descricao ?? null,
            intent.valor ?? null,
            intent.frequencia ?? null,
            intent.tipo ?? null,
            intent.regraMensal ?? null,
            intent.diaDoMes ?? null,
            intent.nDiaUtil ?? null
          );
          break;

        case "ver_saldo":
          processou = true;
          await RelatorioHandler.executar(userId, usuario.id);
          break;

        case "ver_gastos_por_categoria":
          processou = true;
          await GastoPorCategoriaHandler.executar(userId, usuario.id);
          break;

        case "ver_gastos_da_categoria":
          if (intent.categoria) {
            processou = true;
            await GastosDaCategoriaHandler.executar(
              userId,
              usuario.id,
              intent.categoria
            );
          }
          break;

        case "ver_receitas_detalhadas":
          processou = true;
          await ListarReceitasHandler.executar(userId, usuario.id);
          break;

        case "ver_despesas_detalhadas":
          processou = true;
          await ListarDespesasHandler.executar(userId, usuario.id);
          break;

        case "ver_perfil":
          processou = true;
          await PerfilHandler.executar(userId, usuario.id);
          break;

        case "ajuda":
          processou = true;
          await EnviadorWhatsApp.enviar(
            userId,
            "📌 *Como posso te ajudar?*\n\n" +
            "• Registrar *despesa*\n" +
            "• Registrar *receita*\n" +
            "• Ver *saldo*\n" +
            "• Ver *gastos por categoria*\n" +
            "• Criar *lembrete*\n" +
            "• Criar *categoria*"
          );
          break;
      }
    }

    if (processou) return;

    // 5️⃣ FALLBACK
    const resposta = await RespostaGemini.gerar(`
Você é o assistente financeiro *GG Finance*.
Responda em português e apenas sobre finanças.
Mensagem:
"${mensagem}"
    `);

    await EnviadorWhatsApp.enviar(userId, resposta);
  }
}
