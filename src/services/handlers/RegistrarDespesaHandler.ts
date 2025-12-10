import { TransacaoRepository } from "../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";
import { validarValorTransacao } from "../../utils/seguranca.utils";
import { UsuarioRepository } from "../../repositories/usuario.repository";
import { CategoriaAutoService } from "../CategoriaAutoService";

export class RegistrarDespesaHandler {

  static async executar(
    telefone: string,
    usuarioId: string,
    valor: number,
    descricao?: string,
    agendar?: boolean,
    dataAgendadaTexto?: string | null,
    categoriaTexto?: string | null // 👈 AGORA É TEXTO, NÃO ID
  ) {

    const usuario = await UsuarioRepository.buscarPorId(usuarioId);
    if (!usuario) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "⚠️ Usuário não encontrado. Faça o cadastro enviando *1*."
      );
    }

    if (!validarValorTransacao(valor)) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Valor inválido. Digite algo como 25, 100, 350.90...\nExemplo: *300 mercado*"
      );
    }

    // ---------------------------------------------------------
    // 📌 1) RESOLVER CATEGORIA (com IA + regras internas)
    // ---------------------------------------------------------
    const categoria = await CategoriaAutoService.resolver(
      usuarioId,
      categoriaTexto ?? null,
      "despesa",
      descricao ?? null
    );

    const categoriaId = categoria.id;
    const categoriaNomeUsada = categoria.nome;


    // ---------------------------------------------------------
    // 📌 2) TRATAR AGENDAMENTO
    // ---------------------------------------------------------
    let dataAgendada: Date | null = null;

    if (agendar && dataAgendadaTexto) {
      const parsed = new Date(dataAgendadaTexto);

      if (!isNaN(parsed.getTime())) {
        dataAgendada = parsed;
      } else {
        return EnviadorWhatsApp.enviar(
          telefone,
          "📅 Não consegui entender a data que você informou.\n" +
          "Mande novamente no formato *dd/mm/aaaa*.\n\n" +
          "Exemplo: *pagar aluguel dia 10/02/2026*"
        );
      }
    }

    const status = dataAgendada ? "pendente" : "concluida";

    // ---------------------------------------------------------
    // 📌 3) SALVAR DESPESA
    // ---------------------------------------------------------
    const transacao = await TransacaoRepository.criar({
      usuarioId,
      tipo: "despesa",
      valor,
      descricao: descricao ?? undefined,
      categoriaId,
      data: new Date(),
      dataAgendada,
      status
    });

    // ---------------------------------------------------------
    // 📌 4) RESPOSTA (mostrar nome, valor e categoria)
    // ---------------------------------------------------------
    const formatar = (v: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
      }).format(v);

    if (dataAgendada) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "📅 *Despesa agendada!*\n" +
        `📝 *Descrição*: ${transacao.descricao ?? "Sem descrição"}\n` +
        `🏷 *Categoria*: ${categoriaNomeUsada}\n` +
        `💰 *Valor*: ${formatar(Number(transacao.valor))}\n` +
        `🔔 Lembrete em: *${dataAgendada.toLocaleDateString("pt-BR")}*`
      );
    }

    return EnviadorWhatsApp.enviar(
      telefone,
      "💸 *Despesa registrada!*\n" +
      `📝 *Descrição*: ${transacao.descricao ?? "Sem descrição"}\n` +
      `🏷 *Categoria*: ${categoriaNomeUsada}\n` +
      `💰 *Valor*: ${formatar(Number(transacao.valor))}`
    );
  }
}
