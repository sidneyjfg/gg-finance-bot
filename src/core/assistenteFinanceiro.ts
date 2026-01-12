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
import { RecorrenciaHandler } from "../services/handlers/agendamentos/RecorrenciaHandler";
import { ExcluirTransacaoHandler } from "../services/handlers/financeiro/ExcluirTransacaoHandler";
import { GastoPorCategoriaHandler } from "../services/handlers/relatorios/GastoPorCategoriaHandler";
import { GastosDaCategoriaHandler } from "../services/handlers/relatorios/GastosDaCategoriaHandler";
import { RelatorioHandler } from "../services/handlers/relatorios/RelatorioHandler";
import { CategoriaHandler } from "../services/handlers/financeiro/CategoriaHandler";
import { ListarReceitasHandler } from "../services/handlers/financeiro/ListarReceitaHandler";


export class AssistenteFinanceiro {
  static async processar(telefone: string, mensagem: string) {
    const usuario = await UsuarioRepository.buscarPorTelefone(telefone);
    const contexto = await ContextoRepository.obter(telefone);

    // 🔧 Reset de contexto
    const msgLower = mensagem.trim().toLowerCase();
    if (msgLower === "#reset" || msgLower === "/reset") {
      await ContextoRepository.limpar(telefone);
      await EnviadorWhatsApp.enviar(telefone, "🧹 Contexto apagado! Podemos começar do zero.");
      return;
    }

    // 0️⃣ Saudação simples (sem IA)
    if (usuario && !contexto) {
      const msg = mensagem.toLowerCase().trim();
      const ehSaudacao =
        ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"].some(s => msg.startsWith(s)) &&
        msg.length <= 20 &&
        !/\d/.test(msg);

      if (ehSaudacao) {
        await EnviadorWhatsApp.enviar(
          telefone,
          `👋 Olá, *${usuario.nome?.split(" ")[0] || "tudo bem"}*! Como posso te ajudar hoje?`
        );
        return;
      }
    }

    // 1️⃣ CONTEXTO ATIVO (máquina de estados)
    if (contexto) {
      switch (contexto.etapa) {
        case "criando_categoria_nome":
          return CategoriaHandler.salvarNome(telefone, mensagem);

        case "criando_categoria_tipo":
          return CategoriaHandler.salvarTipo(telefone, mensagem, usuario!.id);

        case "informar_data_agendada":
          return AgendamentoHandler.salvarData(telefone, mensagem, usuario!.id);

        case "criando_lembrete_texto":
          return LembreteHandler.salvarTexto(telefone, mensagem);

        case "criando_lembrete_data":
          return LembreteHandler.salvarData(telefone, mensagem, usuario!.id);

        case "criando_lembrete_valor":
          return LembreteHandler.salvarValor(telefone, mensagem, usuario!.id);

        case "complementar_mes_lembrete":
          return LembreteHandler.salvarMes(telefone, mensagem, usuario!.id);

        case "editar_transacao_id":
          return EditarTransacaoHandler.selecionar(telefone, mensagem);

        case "editar_transacao_opcao": {
          const msg = mensagem.trim();
          if (msg.startsWith("1")) return EditarTransacaoHandler.editarValor(telefone, Number(msg));
          if (msg.startsWith("2")) return EditarTransacaoHandler.editarDescricao(telefone, msg);
          break;
        }

        case "excluir_transacao_id":
          return ExcluirTransacaoHandler.confirmar(telefone, mensagem);

        case "confirmar_exclusao":
          return ExcluirTransacaoHandler.executar(telefone, mensagem);

        case "excluir_lembrete_escolher":
          return ExcluirLembreteHandler.escolher(telefone, mensagem);

        case "confirmar_exclusao_lembrete":
          return ExcluirLembreteHandler.executar(telefone, mensagem);

        case "confirmar_criar_recorrencia":
          return RecorrenciaHandler.confirmarCriacao(
            telefone,
            usuario!.id,
            mensagem,
            contexto.dados
          );

        case "informar_valor_recorrencia":
          return RecorrenciaHandler.salvarValor(
            telefone,
            usuario!.id,
            mensagem,
            contexto.dados
          );
      }
    }

    // 2️⃣ Cadastro obrigatório
    if (!usuario) {
      return CadastroUsuarioHandler.executar(telefone, mensagem);
    }

    // 3️⃣ DETECTORES (consultas determinísticas, sem IA)
    const mensagemNormalizada = mensagem
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const ctx = {
      telefone,
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

    // 4️⃣ IA — interpretação semântica
    const interpretacao = await InterpretadorGemini.interpretarMensagem(mensagem, { usuario });
    const intents = Array.isArray(interpretacao) ? interpretacao : [interpretacao];

    let processou = false;

    for (const intent of intents) {
      switch (intent.acao) {
        case "registrar_despesa":
          processou = true;
          await RegistrarDespesaHandler.executar(
            telefone,
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
            telefone,
            usuario.id,
            intent.valor,
            intent.descricao,
            intent.dataAgendada,
            intent.categoria
          );
          break;

        case "criar_categoria":
          processou = true;
          await CategoriaHandler.iniciarCriacao(telefone);
          break;

        case "criar_lembrete":
          processou = true;
          await LembreteHandler.iniciar(
            telefone,
            usuario.id,
            intent.mensagem,
            intent.data,
            intent.valor ?? null,
            mensagem // 👈 FRASE ORIGINAL
          );
          break;

        case "criar_recorrencia":
          processou = true;
          await RecorrenciaHandler.iniciarCriacao(
            telefone,
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
          await RelatorioHandler.executar(telefone, usuario.id);
          break;

        case "ver_gastos_por_categoria":
          processou = true;
          await GastoPorCategoriaHandler.executar(telefone, usuario.id);
          break;

        case "ver_gastos_da_categoria":
          if (intent.categoria) {
            processou = true;
            await GastosDaCategoriaHandler.executar(telefone, usuario.id, intent.categoria);
          }
          break;

        case "ver_receitas_detalhadas":
          processou = true;
          await ListarReceitasHandler.executar(telefone, usuario.id);
          break;

        case "ver_despesas_detalhadas":
          processou = true;
          await ListarDespesasHandler.executar(telefone, usuario.id);
          break;

        case "ver_perfil":
          processou = true;
          await PerfilHandler.executar(telefone, usuario.id);
          break;

        case "ajuda":
          processou = true;
          await EnviadorWhatsApp.enviar(
            telefone,
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

    // 5️⃣ Fallback conversacional
    const resposta = await RespostaGemini.gerar(`
Você é o assistente financeiro *GG Finance*.
Responda em português e apenas sobre finanças.
Mensagem:
"${mensagem}"
    `);

    await EnviadorWhatsApp.enviar(telefone, resposta);
  }
}
