import { TransacaoRepository } from "../../../repositories/transacao.repository";
import { EnviadorWhatsApp } from "../../EnviadorWhatsApp";


type TransacaoComCategoria = Awaited<
  ReturnType<typeof TransacaoRepository.listarDetalhadoPorTipo>
>[number];

export class ListarReceitasHandler {
  static async executar(
    telefone: string,
    usuarioId: string,
    mostrarTodas: boolean = false
  ) {
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
        maximumFractionDigits: 2,
      }).format(valor);

    const limitePadrao = 15; // aqui você escolhe o "limite normal"
    const lista = mostrarTodas ? receitas : receitas.slice(0, limitePadrao);

    const linhas = lista.map((r) => {
      const data = r.data
        ? new Date(r.data).toLocaleDateString("pt-BR")
        : "-";
      const desc = r.descricao ?? "Sem descrição";
      const categoria = (r as TransacaoComCategoria).categoria?.nome ?? "Sem categoria";
      return `• ${data} - ${desc} (${categoria}): ${formatar(
        Number(r.valor)
      )}`;
    });

    const total = receitas.reduce(
      (acc, r) => acc + Number(r.valor),
      0
    );

    const textoLimite = mostrarTodas
      ? ""
      : `\n\n_(mostrando as ${lista.length} mais recentes)_`;

    const mensagem =
      "📈 *Suas receitas registradas*\n\n" +
      linhas.join("\n") +
      `\n\n💰 *Total de receitas:* ${formatar(total)}` +
      textoLimite;

    await EnviadorWhatsApp.enviar(telefone, mensagem);
  }
}
