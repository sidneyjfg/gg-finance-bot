import { TransacaoRepository } from "../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";

export class ListarReceitasHandler {
  static async executar(telefone: string, usuarioId: string) {
    const receitas = await TransacaoRepository.listarDetalhadoPorTipo(
      usuarioId,
      "receita"
    );

    if (!receitas.length) {
      await EnviadorWhatsApp.enviar(
        telefone,
        "📈 Você ainda não tem receitas registradas."
      );
      return;
    }

    const formatar = (valor: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2
      }).format(valor);

    // mostra só as 25 mais recentes pra não virar bíblia
    const recentes = receitas.slice(0, 15);

    const linhas = recentes.map((r) => {
      const data = r.data
        ? new Date(r.data).toLocaleDateString("pt-BR")
        : "-";
      const desc = r.descricao ?? "Sem descrição";
      const categoria = r.categoria?.nome ?? "Sem categoria";
      return `• ${data} - ${desc} (${categoria}): ${formatar(
        Number(r.valor)
      )}`;
    });

    const total = receitas.reduce(
      (acc, r) => acc + Number(r.valor),
      0
    );

    const mensagem =
      "📈 *Suas receitas registradas*\n\n" +
      linhas.join("\n") +
      `\n\n💰 *Total de receitas:* ${formatar(total)}\n` +
      "_(mostrando as 15 mais recentes)_";

    await EnviadorWhatsApp.enviar(telefone, mensagem);
  }
}
