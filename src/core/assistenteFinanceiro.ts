// core/assistenteFinanceiro.ts

import { InterpretadorGemini } from "../ia/interpretadorGemini";
import { RespostaGemini } from "../ia/respostaGemini";

import { RegistrarDespesaHandler } from "../services/handlers/RegistrarDespesaHandler";
import { RegistrarReceitaHandler } from "../services/handlers/RegistrarReceitaHandler";
import { CategoriaHandler } from "../services/handlers/CategoriaHandler";
import { LembreteHandler } from "../services/handlers/LembreteHandler";
import { AgendamentoHandler } from "../services/handlers/AgendamentoHandler";
import { EditarTransacaoHandler } from "../services/handlers/EditarTransacaoHandler";
import { ExcluirTransacaoHandler } from "../services/handlers/ExcluirTransacaoHandler";
import { GastoPorCategoriaHandler } from "../services/handlers/GastoPorCategoriaHandler";
import { GastosDaCategoriaHandler } from "../services/handlers/GastosDaCategoriaHandler";

import { RelatorioHandler } from "../services/handlers/RelatorioHandler";
import { PerfilHandler } from "../services/handlers/PerfilHandler";
import { CadastroUsuarioHandler } from "../services/handlers/CadastroUsuarioHandler";

import { UsuarioRepository } from "../repositories/usuario.repository";
import { ContextoRepository } from "../repositories/contexto.repository";
import { EnviadorWhatsApp } from "../services/EnviadorWhatsApp";
import { ExcluirLembreteHandler } from "../services/handlers/ExcluirLembreteHandler";
import { ListarDespesasHandler } from "../services/handlers/ListarDespesaHandler";
import { ListarReceitasHandler } from "../services/handlers/ListarReceitaHandler";
import { RelatorioReceitasPeriodoHandler } from "../services/handlers/RelatorioReceitasPeriodoHandler";
import { RelatorioDespesasPeriodoHandler } from "../services/handlers/RelatorioDespesasPeriodoHandler";
export class AssistenteFinanceiro {

  static async processar(telefone: string, mensagem: string) {

    const usuario = await UsuarioRepository.buscarPorTelefone(telefone);
    const contexto = await ContextoRepository.obter(telefone);

    // 🔧 Comando de reset de contexto (opcional, mas útil em dev)
    const msgLower = mensagem.trim().toLowerCase();
    if (msgLower === "#reset" || msgLower === "/reset") {
      await ContextoRepository.limpar(telefone);
      await EnviadorWhatsApp.enviar(telefone, "🧹 Contexto apagado! Podemos começar do zero.");
      return;
    }

    // 0) Saudação — apenas se NÃO houver contexto e a mensagem for SÓ saudação
    if (usuario && !contexto) {
      const msgOriginal = mensagem.trim();
      const msg = msgOriginal.toLowerCase().trim();

      const saudacoes = ["oi", "olá", "ola", "ei", "hey", "bom dia", "boa tarde", "boa noite"];

      const comecaComSaudacao = saudacoes.some((s) => msg.startsWith(s));

      // remove quebras de linha e espaços duplicados
      const msgCompacta = msg.replace(/\s+/g, " ");

      // regra: só considero saudação se a mensagem for curta e SEM números,
      // nem palavras típicas de operação financeira ou comando
      const temNumero = /\d/.test(msgCompacta);
      const temPalavraDeAcao = /(recebi|salario|salário|gastei|pagar|paguei|cartao|cartão|boleto|conta|gasto|despesa|receita)/.test(
        msgCompacta
      );

      const mensagemEhSoSaudacao =
        comecaComSaudacao &&
        msgCompacta.length <= 20 && // "bom dia", "boa tarde", "oi tudo bem" etc.
        !temNumero &&
        !temPalavraDeAcao;

      if (mensagemEhSoSaudacao) {
        await EnviadorWhatsApp.enviar(
          telefone,
          `👋 Olá, *${usuario.nome?.split(" ")[0] || "tudo bem"}*! Como posso te ajudar hoje?`
        );
        return;
      }
    }


    // 1) CONTEXTO ATIVO
    if (contexto) {
      const etapa = contexto.etapa;

      switch (etapa) {

        // 📌 Categorias
        case "criando_categoria_nome":
          return CategoriaHandler.salvarNome(telefone, mensagem);

        case "criando_categoria_tipo":
          return CategoriaHandler.salvarTipo(telefone, mensagem, usuario!.id);

        // 📌 Agendamentos
        case "informar_data_agendada":
          return AgendamentoHandler.salvarData(telefone, mensagem, usuario!.id);

        // 📌 Lembretes (criação)
        case "criando_lembrete_texto":
          return LembreteHandler.salvarTexto(telefone, mensagem);

        case "criando_lembrete_data":
          return LembreteHandler.salvarData(telefone, mensagem, usuario!.id);

        case "criando_lembrete_valor":
          return LembreteHandler.salvarValor(telefone, mensagem, usuario!.id);

        case "complementar_mes_lembrete":
          return LembreteHandler.salvarMes(telefone, mensagem, usuario!.id);

        // 📌 Edição de transação
        case "editar_transacao_id":
          return EditarTransacaoHandler.selecionar(telefone, mensagem);

        case "editar_transacao_opcao":
          if (mensagem.startsWith("1"))
            return EditarTransacaoHandler.editarValor(telefone, Number(mensagem));
          if (mensagem.startsWith("2"))
            return EditarTransacaoHandler.editarDescricao(telefone, mensagem);
          break;

        // 📌 Exclusão de transação
        case "excluir_transacao_id":
          return ExcluirTransacaoHandler.confirmar(telefone, mensagem);

        case "confirmar_exclusao":
          return ExcluirTransacaoHandler.executar(telefone, mensagem);

        // 📌 Exclusão de lembrete
        case "excluir_lembrete_escolher":
          return ExcluirLembreteHandler.escolher(telefone, mensagem);

        case "confirmar_exclusao_lembrete":
          return ExcluirLembreteHandler.executar(telefone, mensagem);
      }
    }

    // 2) GATE — Cadastro obrigatório antes de tudo
    if (!usuario) {
      // Agora quem cuida de TUDO (mensagens + fluxo) é o CadastroUsuarioHandler
      return CadastroUsuarioHandler.executar(telefone, mensagem);
    }

    // 2.5) Comando direto: "quanto gastei por categoria?"
    const mensagemNormalizada = mensagem
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // remove acentos

    if (
      mensagemNormalizada.includes("gastei por categoria") ||
      mensagemNormalizada.includes("gastos por categoria") ||
      mensagemNormalizada.includes("gasto por categoria") ||
      mensagemNormalizada.includes("quanto eu gastei por categoria") ||
      mensagemNormalizada.includes("quanto gastei em cada categoria")
    ) {
      await GastoPorCategoriaHandler.executar(telefone, usuario.id);
      return;
    }
    if (
      mensagemNormalizada.includes("minhas receitas") ||
      mensagemNormalizada.includes("ver receitas") ||
      mensagemNormalizada.includes("visualizar receitas") ||
      mensagemNormalizada.includes("listar receitas")
    ) {
      await ListarReceitasHandler.executar(telefone, usuario.id);
      return;
    }

    // 🔹 Ver despesas detalhadas (atalho direto por texto)
    if (
      mensagemNormalizada.includes("minhas despesas") ||
      mensagemNormalizada.includes("ver despesas") ||
      mensagemNormalizada.includes("visualizar despesas") ||
      mensagemNormalizada.includes("listar despesas")
    ) {
      await ListarDespesasHandler.executar(telefone, usuario.id);
      return;
    }
    if (
      mensagemNormalizada.includes("receitas deste mes") ||
      mensagemNormalizada.includes("receitas desse mes") ||
      mensagemNormalizada.includes("receitas do mes atual")
    ) {
      await RelatorioReceitasPeriodoHandler.receitasDoMesAtual(
        telefone,
        usuario.id
      );
      return;
    }
    if (
      mensagemNormalizada.includes("despesas deste mes") ||
      mensagemNormalizada.includes("despesas desse mes") ||
      mensagemNormalizada.includes("despesas do mes atual") ||
      mensagemNormalizada.includes("gastos deste mes")
    ) {
      await RelatorioDespesasPeriodoHandler.despesasDoMesAtual(
        telefone,
        usuario.id
      );
      return;
    }

    // 3) IA Interpretadora (agora com múltiplas ações)
    const interpretacao = await InterpretadorGemini.interpretarMensagem(mensagem, { usuario });

    // Garante que vamos trabalhar sempre com um array
    const intents = Array.isArray(interpretacao) ? interpretacao : [interpretacao];

    console.log("IA:", intents);

    let processouAlgumaAcao = false;

    for (const intent of intents) {

      switch (intent.acao) {

        case "registrar_despesa":
          processouAlgumaAcao = true;
          await RegistrarDespesaHandler.executar(
            telefone,
            usuario!.id,
            intent.valor,
            intent.descricao,
            intent.agendar,
            intent.dataAgendada,
            intent.categoria
          );
          break;

        case "registrar_receita":
          processouAlgumaAcao = true;
          await RegistrarReceitaHandler.executar(
            telefone,
            usuario!.id,
            intent.valor,
            intent.descricao,
            intent.dataAgendada,
            intent.categoria
          );
          break;

        case "criar_categoria":
          processouAlgumaAcao = true;
          await CategoriaHandler.iniciarCriacao(telefone);
          break;

        case "criar_lembrete":
          processouAlgumaAcao = true;
          await LembreteHandler.iniciar(
            telefone,
            usuario!.id,
            intent.mensagem,
            intent.data,
            intent.valor ?? null
          );
          break;

        case "ver_gastos_da_categoria":
          if (intent.categoria) {
            processouAlgumaAcao = true;
            await GastosDaCategoriaHandler.executar(
              telefone,
              usuario.id,
              intent.categoria
            );
          }
          break;

        case "ver_receitas_detalhadas":
          processouAlgumaAcao = true;
          await ListarReceitasHandler.executar(telefone, usuario.id);
          break;

        case "ver_despesas_detalhadas":
          processouAlgumaAcao = true;
          await ListarDespesasHandler.executar(telefone, usuario.id);
          break;

        case "editar_transacao":
          processouAlgumaAcao = true;
          await EditarTransacaoHandler.iniciar(telefone);
          break;

        case "excluir_transacao":
          processouAlgumaAcao = true;
          await ExcluirTransacaoHandler.iniciar(telefone);
          break;

        case "excluir_lembrete":
          processouAlgumaAcao = true;
          await ExcluirLembreteHandler.iniciar(
            telefone,
            usuario.id,
            intent.mensagem,
            intent.data
          );
          break;

        case "ver_saldo":
          processouAlgumaAcao = true;
          await RelatorioHandler.executar(telefone, usuario!.id);
          break;

        case "ver_gastos_por_categoria":
          processouAlgumaAcao = true;
          await GastoPorCategoriaHandler.executar(telefone, usuario!.id);
          break;

        case "ver_perfil":
          processouAlgumaAcao = true;
          await PerfilHandler.executar(telefone, usuario!.id);
          break;

        case "ajuda":
          processouAlgumaAcao = true;
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

        // "desconhecido" e outros casos caem no fallback genérico
      }
    }

    // Se alguma ação foi tratada, não manda resposta genérica
    if (processouAlgumaAcao) {
      return;
    }

    // 5) Resposta IA Genérica Controlada
    const resposta = await RespostaGemini.gerar(`
Você é o assistente financeiro *GG Finance*, integrado ao WhatsApp.
Regras:
- Responda em português
- Fale apenas sobre finanças e o GG Finance
- Sempre sugira ações ao final
Mensagem do usuário:
"${mensagem}"
    `);

    return EnviadorWhatsApp.enviar(telefone, resposta);
  }
}
