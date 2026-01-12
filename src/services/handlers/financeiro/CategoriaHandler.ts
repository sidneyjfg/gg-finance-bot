import { CategoriaRepository } from "../../../repositories/categoria.repository";
import { ContextoRepository } from "../../../repositories/contexto.repository";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";


export class CategoriaHandler {

  static async iniciarCriacao(telefone: string) {
    await ContextoRepository.salvar(telefone, { etapa: "criando_categoria_nome" });
    return EnviadorWhatsApp.enviar(
      telefone,
      "📂 Qual o *nome da categoria*?"
    );
  }

  static async salvarNome(telefone: string, nome: string) {
    await ContextoRepository.atualizarDados(telefone, { nome });
    await ContextoRepository.salvar(telefone, { etapa: "criando_categoria_tipo" });

    return EnviadorWhatsApp.enviar(
      telefone,
      "Essa categoria é de:\n1️⃣ Receita\n2️⃣ Despesa"
    );
  }

  static async salvarTipo(telefone: string, tipoMsg: string, usuarioId: string) {
    const tipo = tipoMsg.startsWith("1") ? "receita" :
                 tipoMsg.startsWith("2") ? "despesa" : null;

    if (!tipo) {
      return EnviadorWhatsApp.enviar(telefone, "Escolha 1 ou 2.");
    }

    const ctx = await ContextoRepository.obter(telefone);
    const { nome } = ctx!.dados as { nome: string };

    await CategoriaRepository.criar({
      usuarioId,
      nome,
      tipo
    });

    await ContextoRepository.limpar(telefone);

    return EnviadorWhatsApp.enviar(
      telefone,
      `✅ Categoria *${nome}* criada como *${tipo}*!`
    );
  }
}
