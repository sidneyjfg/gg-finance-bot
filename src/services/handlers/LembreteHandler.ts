import { LembreteRepository } from "../../repositories/lembrete.repository";
import { ContextoRepository } from "../../repositories/contexto.repository";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";

export class LembreteHandler {

  // Agora aceita mensagem + data + valor opcionais vindos da IA
  static async iniciar(
    telefone: string,
    usuarioId: string,
    mensagem: string | null,
    data: string | null,
    valor: number | null = null
  ) {

    // Se mensagem, valor e data estão completos → salvar direto
    if (mensagem && data && valor !== null) {
      return this.salvarCompleto(telefone, usuarioId, mensagem, data, valor);
    }

    // Tem mensagem + valor → falta data
    if (mensagem && valor !== null && !data) {
      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_data",
        dados: { mensagem, valor }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "📅 Você não informou *quando* devo te lembrar disso.\nQual é a data do lembrete?"
      );
    }

    // Tem mensagem + data → falta valor
    if (mensagem && data && valor === null) {
      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_valor",
        dados: { mensagem, data }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "💰 Você não informou o *valor*. Quer deixar sem valor ou deseja informar agora?"
      );
    }

    // Tem só mensagem
    if (mensagem && !data) {
      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_data",
        dados: { mensagem, valor }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "📅 Quando você quer que eu te lembre disso?"
      );
    }

    // Tem só data
    if (data && !mensagem) {
      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_texto",
        dados: { data, valor }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "💭 O que você quer que eu te lembre?"
      );
    }

    // Nada válido → inicia fluxo padrão
    await ContextoRepository.salvar(telefone, {
      etapa: "criando_lembrete_texto"
    });

    return EnviadorWhatsApp.enviar(
      telefone,
      "💭 O que você quer que eu te lembre?"
    );
  }

  // Salvar lembrete direto
  static async salvarCompleto(
    telefone: string,
    usuarioId: string,
    mensagem: string,
    data: string,
    valor: number | null
  ) {

    await LembreteRepository.criar({
      usuarioId,
      mensagem,
      data,
      valor
    });

    await ContextoRepository.limpar(telefone);

    return EnviadorWhatsApp.enviar(
      telefone,
      `🔔 Prontinho! Vou te lembrar: *${mensagem}* no dia *${data}*${valor !== null ? ` (R$ ${valor})` : ""}.`
    );
  }

  // Fluxo manual — texto
  static async salvarTexto(telefone: string, texto: string) {
    await ContextoRepository.atualizarDados(telefone, { texto });

    await ContextoRepository.salvar(telefone, {
      etapa: "criando_lembrete_data",
      dados: { texto }
    });

    return EnviadorWhatsApp.enviar(
      telefone,
      "📆 Quando devo te lembrar? (ex: 20/11 ou 20/11/2025)"
    );
  }

  // Fluxo manual — data
  static async salvarData(telefone: string, dataMsg: string, usuarioId: string) {
    const ctx = await ContextoRepository.obter(telefone);

    if (!ctx || !ctx.dados || !ctx.dados.texto) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "⚠️ Não encontrei o texto do lembrete.\nVamos começar de novo? O que você quer lembrar?"
      );
    }

    const texto = ctx.dados.texto;

    const data = parseDataPtBr(dataMsg);
    if (!data) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Não consegui entender essa data.\nTente *20/11* ou *20/11/2025*."
      );
    }

    await LembreteRepository.criar({
      usuarioId,
      mensagem: texto,
      dataAlvo: data
    });

    await ContextoRepository.limpar(telefone);

    return EnviadorWhatsApp.enviar(
      telefone,
      "⏰ Lembrete criado com sucesso!"
    );
  }
}


// Conversão de datas
function parseDataPtBr(texto: string): Date | null {
  if (!texto) return null;
  texto = texto.trim();

  const direto = new Date(texto);
  if (!isNaN(direto.getTime())) return direto;

  const m1 = texto.match(/^(\d{1,2})[\/\-](\d{1,2})([\/\-](\d{2,4}))?$/);
  if (m1) {
    const dia = Number(m1[1]);
    const mes = Number(m1[2]) - 1;
    const ano = m1[3] ? Number(m1[3].replace(/[\/\-]/, "")) : new Date().getFullYear();
    const d = new Date(ano, mes, dia);
    if (!isNaN(d.getTime())) return d;
  }

  const meses: Record<string, number> = {
    janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4,
    junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
  };

  const m2 = texto.match(
    /(\d{1,2}).*?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:.*?(\d{4}))?/i
  );
  if (m2) {
    const dia = Number(m2[1]);
    const mes = meses[m2[2].toLowerCase()];
    const ano = m2[3] ? Number(m2[3]) : new Date().getFullYear();
    const d = new Date(ano, mes, dia);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}
