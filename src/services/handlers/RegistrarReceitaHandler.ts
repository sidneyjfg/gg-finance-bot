import { TransacaoRepository } from "../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";
import { validarValorTransacao } from "../../utils/seguranca.utils";
import { UsuarioRepository } from "../../repositories/usuario.repository";
import { CategoriaAutoService } from "../CategoriaAutoService";

export class RegistrarReceitaHandler {

  static async executar(
    telefone: string,
    usuarioId: string,
    valor: number,
    descricao?: string,
    dataAgendadaTexto?: string | null,
    categoriaTexto?: string | null
  ) {

    // -------------------------------
    // 📌 Garantir que usuário existe
    // -------------------------------
    const usuario = await UsuarioRepository.buscarPorId(usuarioId);
    if (!usuario) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "⚠️ Usuário não encontrado. Envie *1* para cadastrar."
      );
    }

    // -------------------------------
    // 📌 Validar valor
    // -------------------------------
    if (!validarValorTransacao(valor)) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Valor inválido. Digite um número positivo.\nExemplo: *1500*"
      );
    }

    // -------------------------------
    // 📌 Resolver categoria automaticamente
    // -------------------------------
    const categoria = await CategoriaAutoService.resolver(
      usuarioId,
      categoriaTexto ?? null,
      "receita",
      descricao ?? null
    );

    const categoriaId = categoria.id;
    const categoriaNomeUsada = categoria.nome;

    // -------------------------------
    // 📌 Tratar data agendada (se houver)
    // -------------------------------
    let dataAgendada: Date | null = null;
      
    if (dataAgendadaTexto) {
      const parsed = new Date(dataAgendadaTexto);
      if (!isNaN(parsed.getTime())) {
        dataAgendada = parsed;
      } else {
        return EnviadorWhatsApp.enviar(
          telefone,
          "📅 Não consegui entender a data informada. Use o formato *dd/mm/aaaa*."
        );
      }
    }

    const status = dataAgendada ? "pendente" : "concluida";

    // -------------------------------
    // 📌 Criar transação no banco
    // -------------------------------
    const transacao = await TransacaoRepository.criar({
      usuarioId,
      tipo: "receita",
      valor,
      descricao: descricao ?? "Receita sem descrição",
      categoriaId,        // 👈 agora é string, correto!
      data: new Date(),
      dataAgendada,
      status
    });

    // -------------------------------
    // 📌 Enviar resposta ao usuário
    // -------------------------------
    const formatar = (v: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
      }).format(v);

    // Receita agendada
    if (dataAgendada) {
      return EnviadorWhatsApp.enviar(
        telefone,
        `📅 *Receita agendada!*
📝 ${transacao.descricao}
🏷 Categoria: ${categoriaNomeUsada}
💰 Valor: ${formatar(valor)}
🔔 Para: ${dataAgendada.toLocaleDateString("pt-BR")}`
      );
    }

    // Receita concluída
    return EnviadorWhatsApp.enviar(
      telefone,
      `✅ *Receita registrada!*
📝 ${transacao.descricao}
🏷 Categoria: ${categoriaNomeUsada}
💰 Valor: ${formatar(valor)}`
    );
  }
}
