// core/assistenteFinanceiro.ts CORRIGIDO

import { InterpretadorGemini } from "../ia/interpretadorGemini";
import { RespostaGemini } from "../ia/respostaGemini";

import { RegistrarDespesaHandler } from "../services/handlers/RegistrarDespesaHandler";
import { RegistrarReceitaHandler } from "../services/handlers/RegistrarReceitaHandler";
import { CategoriaHandler } from "../services/handlers/CategoriaHandler";
import { LembreteHandler } from "../services/handlers/LembreteHandler";
import { AgendamentoHandler } from "../services/handlers/AgendamentoHandler";
import { EditarTransacaoHandler } from "../services/handlers/EditarTransacaoHandler";
import { ExcluirTransacaoHandler } from "../services/handlers/ExcluirTransacaoHandler";

import { RelatorioHandler } from "../services/handlers/RelatorioHandler";
import { PerfilHandler } from "../services/handlers/PerfilHandler";
import { CadastroUsuarioHandler } from "../services/handlers/CadastroUsuarioHandler";

import { UsuarioRepository } from "../repositories/usuario.repository";
import { ContextoRepository } from "../repositories/contexto.repository";
import { EnviadorWhatsApp } from "../services/EnviadorWhatsApp";
import { ExcluirLembreteHandler } from "../services/handlers/ExcluirLembreteHandler";

export class AssistenteFinanceiro {

  static async processar(telefone: string, mensagem: string) {

    const usuario = await UsuarioRepository.buscarPorTelefone(telefone);
    const contexto = await ContextoRepository.obter(telefone);

    // 0) Saudação — apenas se não houver contexto e mensagem for saudação
    if (usuario && !contexto) {
      const msg = mensagem.toLowerCase().trim();
      const eSaudacao = ["oi", "olá", "ola", "ei", "hey", "bom dia", "boa tarde", "boa noite"]
        .some(s => msg.startsWith(s));

      if (eSaudacao) {
        await EnviadorWhatsApp.enviar(
          telefone,
          `👋 Olá, *${usuario.nome?.split(" ")[0] || "tudo bem"}*! Como posso te ajudar hoje?`
        );
        return;
      }
    }

    // 1) CONTEXTO ATIVO
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

        // 📌 Exclusão de lembrete (AQUI ESTAVA FALTANDO)
        case "excluir_lembrete_escolher":
          return ExcluirLembreteHandler.escolher(telefone, mensagem);

        case "confirmar_exclusao_lembrete":
          return ExcluirLembreteHandler.executar(telefone, mensagem);
      }
    }

    // 2) GATE — Cadastro obrigatório antes de tudo
    if (!usuario) {
      return CadastroUsuarioHandler.executar(telefone, mensagem);
    }

    // 3) IA Interpretadora
    const intent = await InterpretadorGemini.interpretarMensagem(mensagem, { usuario });
    console.log("IA:", intent);

    // const requerCadastro = [
    //   "registrar_despesa", "registrar_receita", "criar_categoria",
    //   "editar_transacao", "excluir_transacao", "criar_lembrete",
    //   "ver_saldo", "ver_perfil"
    // ];

    // if (!usuario && requerCadastro.includes(intent.acao)) {
    //   await EnviadorWhatsApp.enviar(telefone, "Para continuar, preciso do seu nome completo 🙂");
    //   return CadastroUsuarioHandler.executar(telefone, mensagem);
    // }

    // 4) ROTAS PRINCIPAIS
    switch (intent.acao) {

      case "registrar_despesa":
        return RegistrarDespesaHandler.executar(
          telefone,
          usuario!.id,
          intent.valor,
          intent.descricao,
          intent.dataAgendada, // ✔ corrigido
          intent.categoria      // ✔ corrigido
        );

      case "registrar_receita":
        return RegistrarReceitaHandler.executar(
          telefone,
          usuario!.id,
          intent.valor,
          intent.descricao,
          intent.dataAgendada, // ✔ corrigido (antes estava recebendo boolean!)
          intent.categoria     // ✔ corrigido
        );

      case "criar_categoria":
        return CategoriaHandler.iniciarCriacao(telefone);

      case "criar_lembrete":
        return LembreteHandler.iniciar(
          telefone,
          usuario!.id,
          intent.mensagem,
          intent.data,
          intent.valor ?? null
        );

      case "editar_transacao":
        return EditarTransacaoHandler.iniciar(telefone);

      case "excluir_transacao":
        return ExcluirTransacaoHandler.iniciar(telefone);

      case "excluir_lembrete":
        return ExcluirLembreteHandler.iniciar(
          telefone,
          usuario.id,
          intent.mensagem,
          intent.data
        );

      case "excluir_lembrete_escolher":
        return ExcluirLembreteHandler.escolher(telefone, mensagem);

      case "confirmar_exclusao_lembrete":
        return ExcluirLembreteHandler.executar(telefone, mensagem);

      case "ver_saldo":
        return RelatorioHandler.executar(telefone, usuario!.id);

      case "ver_perfil":
        return PerfilHandler.executar(telefone, usuario!.id);

      case "cadastrar_usuario":
        return CadastroUsuarioHandler.executar(telefone, mensagem);

      case "ajuda":
        return EnviadorWhatsApp.enviar(
          telefone,
          "📌 *Como posso te ajudar?*\n\n" +
          "• Registrar *despesa*\n" +
          "• Registrar *receita*\n" +
          "• Ver *saldo*\n" +
          "• Criar *lembrete*\n" +
          "• Criar *categoria*"
        );
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
