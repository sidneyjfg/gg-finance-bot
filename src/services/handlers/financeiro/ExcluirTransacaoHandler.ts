import { ContextoRepository } from "../../../repositories/contexto.repository";
import { TransacaoRepository } from "../../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";

export class ExcluirTransacaoHandler {

  static async iniciar(telefone: string) {
    await ContextoRepository.salvar(telefone, {
      etapa: "excluir_transacao_id",
      dados: {}
    });

    return EnviadorWhatsApp.enviar(
      telefone,
      "🗑 Envie o ID da transação que deseja excluir."
    );
  }

  static async confirmar(telefone: string, id: string) {
    await ContextoRepository.salvar(telefone, {
      etapa: "confirmar_exclusao",
      dados: { id }
    });

    return EnviadorWhatsApp.enviar(
      telefone,
      `⚠ Tem certeza que deseja excluir?\nID: ${id}\n\nResponda *sim* ou *não*.`
    );
  }

  static async executar(telefone: string, confirmacao: string) {
    const ctx = await ContextoRepository.obter(telefone);
    const dados = ctx?.dados as { id: string };

    if (!dados?.id) {
      return EnviadorWhatsApp.enviar(telefone, "⚠️ Não encontrei a transação.");
    }

    if (!confirmacao.toLowerCase().startsWith("s")) {
      await ContextoRepository.limpar(telefone);
      return EnviadorWhatsApp.enviar(telefone, "Operação cancelada.");
    }

    await TransacaoRepository.deletar(dados.id);
    await ContextoRepository.limpar(telefone);

    return EnviadorWhatsApp.enviar(
      telefone,
      "🗑 Transação excluída com sucesso!"
    );
  }

}
