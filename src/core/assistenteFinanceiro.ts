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

import { RecorrenciaHandler } from "../services/handlers/RecorrenciaHandler";

import { RelatorioHandler } from "../services/handlers/RelatorioHandler";
import { PerfilHandler } from "../services/handlers/PerfilHandler";
import { CadastroUsuarioHandler } from "../services/handlers/CadastroUsuarioHandler";

import { UsuarioRepository } from "../repositories/usuario.repository";
import { ContextoRepository } from "../repositories/contexto.repository";
import { EnviadorWhatsApp } from "../services/EnviadorWhatsApp";


export class AssistenteFinanceiro {

  static async processar(telefone: string, mensagem: string) {

    const usuario = await UsuarioRepository.buscarPorTelefone(telefone);
    const contexto = await ContextoRepository.obter(telefone);

    // 0) Se o usuário já existe e não há fluxo em andamento → saudação curta
    if (usuario && !contexto) {
      await EnviadorWhatsApp.enviar(
        telefone,
        `👋 Olá, *${usuario.nome?.split(" ")[0] || "tudo bem"}*! Como posso te ajudar hoje?`
      );
    }

    // 1) Se há etapa em andamento → continuar fluxo normal
    // 1) Se há etapa em andamento → continuar fluxo normal
    if (contexto) {
      const etapa = contexto.etapa;

      switch (etapa) {

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

        case "editar_transacao_id":
          return EditarTransacaoHandler.selecionar(telefone, mensagem);

        case "editar_transacao_opcao":
          if (mensagem.startsWith("1"))
            return EditarTransacaoHandler.editarValor(telefone, Number(mensagem));

          if (mensagem.startsWith("2"))
            return EditarTransacaoHandler.editarDescricao(telefone, mensagem);

        case "excluir_transacao_id":
          return ExcluirTransacaoHandler.confirmar(telefone, mensagem);

        case "confirmar_exclusao":
          return ExcluirTransacaoHandler.executar(telefone, mensagem);
      }
    }
    

    // 2) 🔒 GATE DE CADASTRO:
    //    Se ainda não tem usuário, NÃO usa IA pra interpretar intenção nem pra resposta.
    if (!usuario) {
      await EnviadorWhatsApp.enviar(
        telefone,
        "👋 Olá! Antes de usar o *GG Finance*, preciso fazer um cadastro bem rapidinho.\n\n" +
        "Por favor, me envie *seu nome completo* 😊"
      );

      // Deixa o CadastroUsuarioHandler cuidar da próxima etapa (salvar nome, depois CPF etc.)
      return CadastroUsuarioHandler.executar(telefone, mensagem);
    }

    // 3) A partir daqui, só quem já é cadastrado cai na IA de interpretação
    const intent = await InterpretadorGemini.interpretarMensagem(mensagem, { usuario });
    console.log("IA:", intent);

    const requerCadastro = [
      "registrar_despesa",
      "registrar_receita",
      "criar_categoria",
      "editar_transacao",
      "excluir_transacao",
      "criar_lembrete",
      "ver_saldo",
      "ver_perfil"
    ];

    // Segurança extra: se por algum motivo vier ação que exige cadastro sem usuário
    if (!usuario && requerCadastro.includes(intent.acao)) {
      await EnviadorWhatsApp.enviar(telefone, "Para continuar, preciso do seu nome completo 🙂");
      return CadastroUsuarioHandler.executar(telefone, mensagem);
    }

    // 4) ROTAS PRINCIPAIS
    switch (intent.acao) {

      case "registrar_despesa":
        return RegistrarDespesaHandler.executar(
          telefone,
          usuario!.id,
          intent.valor,
          intent.descricao,
          intent.agendar,
          intent.dataAgendada
        );

      case "registrar_receita":
        return RegistrarReceitaHandler.executar(
          telefone,
          usuario!.id,
          intent.valor,
          intent.descricao,
          intent.agendar,
          intent.dataAgendada
        );

      case "criar_categoria":
        return CategoriaHandler.iniciarCriacao(telefone);

      case "criar_lembrete":
        return LembreteHandler.iniciar(
          telefone,
          usuario!.id,
          intent.mensagem,
          intent.data,
          intent.valor ?? null   // adiciona o valor
        );

      case "criar_recorrencia":
        // handler específico quando você implementar
        break;

      case "editar_transacao":
        return EditarTransacaoHandler.iniciar(telefone);

      case "excluir_transacao":
        return ExcluirTransacaoHandler.iniciar(telefone);

      case "ver_saldo":
        return RelatorioHandler.executar(telefone, usuario!.id);

      case "ver_perfil":
        return PerfilHandler.executar(telefone, usuario!.id);

      case "cadastrar_usuario":
        // se quiser permitir atualizar cadastro via comando
        return CadastroUsuarioHandler.executar(telefone, mensagem);

      case "ajuda":
        return EnviadorWhatsApp.enviar(
          telefone,
          "📌 *Como posso te ajudar agora?*\n\n" +
          "• Registrar uma *despesa* — ex: \"gastei 50 no mercado\"\n" +
          "• Registrar uma *receita* — ex: \"ganhei 300 de freelas\"\n" +
          "• *Ver saldo* — mande: ver saldo\n" +
          "• Criar um *lembrete* — ex: \"me lembra de pagar boleto dia 10\"\n" +
          "• Criar uma *categoria* — ex: \"criar categoria mercado\"\n"
        );
    }

    // 5) DESCONHECIDO → aqui entra a IA de resposta (ResposaGemini),
    //    mas SEM ser um chat genérico: só finanças + uso do GG Finance.
    const resposta = await RespostaGemini.gerar(`
Você é o assistente financeiro *GG Finance*, integrado ao WhatsApp.

Regras IMPORTANTES:
- Responda em português do Brasil.
- Seja amigável, direto e fácil de entender.
- Fale APENAS sobre:
  - finanças pessoais (gastos, receitas, organização financeira)
  - e sobre como usar o próprio GG Finance (comandos, exemplos, funções).
- NÃO responda perguntas fora desse contexto (nada de política, fofoca, curiosidades aleatórias etc.).
- Use exemplos com valores em reais (R$).
- No final da resposta, sugira SEMPRE algumas ações que o usuário pode fazer no GG Finance, como:
  - registrar uma despesa
  - registrar uma receita
  - ver saldo
  - criar um lembrete
  - criar uma categoria

Mensagem do usuário:
"${mensagem}"
    `);

    return EnviadorWhatsApp.enviar(telefone, resposta);
  }
}
