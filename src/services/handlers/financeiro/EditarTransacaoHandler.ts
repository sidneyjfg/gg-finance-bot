import { ContextoRepository } from "../../../repositories/contexto.repository";
import { TransacaoRepository } from "../../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";


export class EditarTransacaoHandler {

  static async iniciar(telefone: string) {
    await ContextoRepository.salvar(telefone, { etapa: "editar_transacao_id" });

    return EnviadorWhatsApp.enviar(
      telefone,
      "✏️ Informe o ID da transação que deseja editar."
    );
  }

  static async selecionar(telefone: string, id: string) {
    const transacao = await TransacaoRepository.buscarPorId(id);

    if (!transacao) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Transação não encontrada."
      );
    }

    await ContextoRepository.salvar(telefone, {
      etapa: "editar_transacao_opcao",
      dados: { id }
    });

    return EnviadorWhatsApp.enviar(
      telefone,
      "O que deseja editar?\n1️⃣ Valor\n2️⃣ Descrição\n3️⃣ Data"
    );
  }

  static async editarValor(telefone: string, valor: number) {
    const ctx = await ContextoRepository.obter(telefone);
    if (!ctx?.dados) {
      return EnviadorWhatsApp.enviar(telefone, "⚠ Nenhuma transação selecionada.");
    }

    const { id } = ctx.dados as { id: string };

    await TransacaoRepository.atualizar(id, { valor });

    await ContextoRepository.limpar(telefone);

    return EnviadorWhatsApp.enviar(telefone, "✔ Valor atualizado!");
  }

  static async editarDescricao(telefone: string, desc: string) {
    const ctx = await ContextoRepository.obter(telefone);
    if (!ctx?.dados) {
      return EnviadorWhatsApp.enviar(telefone, "⚠ Nenhuma transação selecionada.");
    }

    const { id } = ctx.dados as { id: string };

    await TransacaoRepository.atualizar(id, { descricao: desc });

    await ContextoRepository.limpar(telefone);

    return EnviadorWhatsApp.enviar(telefone, "✔ Descrição atualizada!");
  }
}
