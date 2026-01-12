import { LembreteRepository } from "../../../repositories/lembrete.repository";
import { ContextoRepository } from "../../../repositories/contexto.repository";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";
import { parseDataPtBr } from "../../../utils/parseDatabr";
import { Lembrete } from "@prisma/client";

export class ExcluirLembreteHandler {

  static async iniciar(telefone: string, usuarioId: string, mensagem: string | null, dataStr: string | null) {

    let candidatos: Lembrete[] = [];

    if (mensagem && dataStr) {
      const data = parseDataPtBr(dataStr);
      if (data) {
        candidatos = await LembreteRepository.buscarPorTextoEData(usuarioId, mensagem, data);
      }
    }

    if (candidatos.length === 0 && mensagem) {
      candidatos = await LembreteRepository.buscarSemData(usuarioId, mensagem);
    }

    if (candidatos.length === 0) {
      const todos = await LembreteRepository.listarFuturos(usuarioId);

      if (todos.length === 0) {
        return EnviadorWhatsApp.enviar(telefone, "⚠️ Você não tem lembretes futuros para excluir.");
      }

      await ContextoRepository.salvar(telefone, {
        etapa: "excluir_lembrete_escolher",
        dados: { lista: todos }
      });

      let texto = "❌ Não encontrei esse lembrete.\n\n📋 *Seus lembretes:*\n\n";
      todos.forEach((l, i) => {
        texto += `(${i + 1}) ${l.mensagem}\n📅 ${l.dataAlvo?.toLocaleDateString("pt-BR")}\n${l.valor ? "💰 R$ " + l.valor : ""}\n\n`;
      });

      texto += "Envie o *número* do lembrete que deseja excluir.";
      return EnviadorWhatsApp.enviar(telefone, texto);
    }

    if (candidatos.length === 1) {
      await LembreteRepository.deletar(candidatos[0].id);

      return EnviadorWhatsApp.enviar(
        telefone,
        `🗑 Lembrete excluído:\n"${candidatos[0].mensagem}" – ${candidatos[0].dataAlvo?.toLocaleDateString("pt-BR")}`
      );
    }

    await ContextoRepository.salvar(telefone, {
      etapa: "excluir_lembrete_escolher",
      dados: { lista: candidatos }
    });

    let texto = "📋 *Encontrei vários lembretes parecidos:*\n\n";

    candidatos.forEach((l, i) => {
      texto += `(${i + 1}) ${l.mensagem}\n📅 ${l.dataAlvo?.toLocaleDateString("pt-BR")}\n${l.valor ? "💰 R$ " + l.valor : ""}\n\n`;
    });

    texto += "Envie o *número* do lembrete que deseja excluir.";

    return EnviadorWhatsApp.enviar(telefone, texto);
  }

  static async escolher(telefone: string, opcao: string) {
    const ctx = await ContextoRepository.obter(telefone);
    const dados = ctx?.dados as { lista: Lembrete[] };

    const lista = dados?.lista ?? [];

    const index = Number(opcao) - 1;
    if (isNaN(index) || !lista[index]) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "Opção inválida. Envie apenas o número da lista."
      );
    }

    const selecionado = lista[index];

    const dataFormatada = selecionado.dataAlvo
      ? new Date(selecionado.dataAlvo).toLocaleDateString("pt-BR")
      : "Sem data";

    await ContextoRepository.salvar(telefone, {
      etapa: "confirmar_exclusao_lembrete",
      dados: { id: selecionado.id }
    });

    return EnviadorWhatsApp.enviar(
      telefone,
      `Confirmar exclusão?\n\n📝 ${selecionado.mensagem}\n📅 ${dataFormatada}\n\nResponda *sim* ou *não*.`
    );
  }

  static async executar(telefone: string, confirmacao: string) {
    const ctx = await ContextoRepository.obter(telefone);

    const dados = ctx?.dados as { id: string };

    if (!dados?.id) {
      return EnviadorWhatsApp.enviar(telefone, "⚠️ Não encontrei o lembrete para excluir.");
    }

    if (!confirmacao.toLowerCase().startsWith("s")) {
      await ContextoRepository.limpar(telefone);
      return EnviadorWhatsApp.enviar(telefone, "Operação cancelada.");
    }

    await LembreteRepository.deletar(dados.id);
    await ContextoRepository.limpar(telefone);

    return EnviadorWhatsApp.enviar(telefone, "🗑 Lembrete excluído com sucesso!");
  }
}
