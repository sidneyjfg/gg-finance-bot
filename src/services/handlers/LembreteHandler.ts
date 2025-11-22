import { LembreteRepository } from "../../repositories/lembrete.repository";
import { ContextoRepository } from "../../repositories/contexto.repository";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";
import { LembreteClassifier } from "../../utils/LembreteClassifier";
import { extrairDiaSimples, normalizarMes, parseDataPtBr } from "../../utils/parseDatabr";

export class LembreteHandler {

  /**
   * Fluxo iniciado via IA:
   *  - mensagem: texto do lembrete (ex: "pagamento do aluguel")
   *  - data: string entendida pela IA (ex: "dia 1", "10/02", "amanhã")
   *  - valor: número ou null
   */
  static async iniciar(
    telefone: string,
    usuarioId: string,
    mensagem: string | null,
    data: string | null,
    valor: number | null = null
  ) {

    // ✅ Caso 1: tudo completo → tenta salvar direto
    if (mensagem && data && valor !== null) {
      return this.salvarCompletoComParse(telefone, usuarioId, mensagem, data, valor);
    }

    // ✅ Caso 2: mensagem + valor → falta data
    if (mensagem && valor !== null && !data) {
      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_data",
        dados: { mensagem, valor }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "📅 Falta a data. Quando devo te lembrar disso? Ex: *10/02* ou *amanhã*."
      );
    }

    // ✅ Caso 3: mensagem + data → falta valor
    if (mensagem && data && valor === null) {
      const apenasDia = extrairDiaSimples(data); // ex: "dia 1" → 1, "1" → 1, "1/12" → null

      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_valor",
        dados: {
          mensagem,
          data,
          dia: apenasDia // se for só um dia sem mês, guardamos aqui
        }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "💰 Você não informou o *valor*. Qual é o valor desse lembrete? Ex: *1000*."
      );
    }

    // ✅ Caso 4: só mensagem → perguntar data
    if (mensagem && !data) {
      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_data",
        dados: { mensagem, valor }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "📅 Quando você quer que eu te lembre disso? Ex: *20/11* ou *amanhã*."
      );
    }

    // ✅ Caso 5: só data → perguntar texto
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

    // ✅ Caso 6: nada útil → fluxo manual
    await ContextoRepository.salvar(telefone, {
      etapa: "criando_lembrete_texto"
    });

    return EnviadorWhatsApp.enviar(
      telefone,
      "💭 O que você quer que eu te lembre?"
    );
  }

  /**
   * Quando já recebemos mensagem + data (string) + valor,
   * tentamos parsear a data direto.
   */
  private static async salvarCompletoComParse(
    telefone: string,
    usuarioId: string,
    mensagem: string,
    dataStr: string,
    valor: number | null
  ) {
    const data = parseDataPtBr(dataStr);

    if (!data) {
      // Se a data não foi entendida, volta pro fluxo pedindo a data de novo
      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_data",
        dados: { mensagem, valor }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Não consegui entender a data que você informou.\n" +
        "Me diga apenas a data, por exemplo: *10/02* ou *amanhã*."
      );
    }

    await LembreteRepository.criar({
      usuarioId,
      mensagem,
      dataAlvo: data,
      valor
    });

    await ContextoRepository.limpar(telefone);

    return EnviadorWhatsApp.enviar(
      telefone,
      `🔔 Prontinho! Vou te lembrar: *${mensagem}* no dia *${data.toLocaleDateString("pt-BR")}*` +
      `${valor !== null ? ` (R$ ${valor})` : ""}.`
    );
  }

  /**
   * Versão antiga mantida por compatibilidade, caso seja usada em outro lugar.
   */
  static async salvarCompleto(
    telefone: string,
    usuarioId: string,
    mensagem: string,
    data: string,
    valor: number | null
  ) {
    const dataAlvo = parseDataPtBr(data);

    await LembreteRepository.criar({
      usuarioId,
      mensagem,
      dataAlvo,
      valor
    });

    await ContextoRepository.limpar(telefone);

    return EnviadorWhatsApp.enviar(
      telefone,
      `🔔 Prontinho! Vou te lembrar: *${mensagem}* no dia *${data}*` +
      `${valor !== null ? ` (R$ ${valor})` : ""}.`
    );
  }

  /**
   * Fluxo manual — salva o TEXTO e pergunta a data.
   */
  static async salvarTexto(telefone: string, texto: string) {
    await ContextoRepository.atualizarDados(telefone, { texto });

    await ContextoRepository.salvar(telefone, {
      etapa: "criando_lembrete_data",
      dados: { texto }
    });

    return EnviadorWhatsApp.enviar(
      telefone,
      "📆 Quando devo te lembrar? (ex: *20/11*, *amanhã* ou *20/11/2025*)"
    );
  }

  /**
   * Fluxo manual — recebe a data como texto, converte e salva.
   * Usado quando a etapa é "criando_lembrete_data".
   */
  static async salvarData(telefone: string, dataMsg: string, usuarioId: string) {
    const ctx = await ContextoRepository.obter(telefone);

    if (!ctx || !ctx.dados) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "⚠️ Não encontrei o lembrete anterior.\nVamos começar de novo? O que você quer lembrar?"
      );
    }

    const texto = ctx.dados.mensagem ?? ctx.dados.texto;
    const valor = ctx.dados.valor ?? null;

    if (!texto) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "⚠️ Não encontrei o texto do lembrete.\nVamos começar de novo? O que você quer lembrar?"
      );
    }

    const data = parseDataPtBr(dataMsg);
    if (!data) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Não consegui entender essa data.\n" +
        "Tente algo como *20/11*, *20/11/2025* ou *amanhã*."
      );
    }

    await LembreteRepository.criar({
      usuarioId,
      mensagem: texto,
      dataAlvo: data,
      valor
    });

    await ContextoRepository.limpar(telefone);

    return EnviadorWhatsApp.enviar(
      telefone,
      "⏰ Lembrete criado com sucesso!"
    );
  }

  /**
   * Fluxo manual — recebe apenas o VALOR.
   * Pode vir de dois cenários:
   *  - já tínhamos data completa (ex: "10/02") → salva direto
   *  - só tínhamos "dia 1" → pergunta "1 de qual mês?"
   *  - não tínhamos data → pergunta data completa
   */
  static async salvarValor(telefone: string, valorMsg: string, usuarioId: string) {
    const ctx = await ContextoRepository.obter(telefone);

    if (!ctx || !ctx.dados) {
      await ContextoRepository.limpar(telefone);
      return EnviadorWhatsApp.enviar(
        telefone,
        "⚠️ Não encontrei o lembrete anterior. Vamos começar de novo?\n" +
        "Digite novamente o que você quer lembrar."
      );
    }

    const numeroExtraido = Number(valorMsg.replace(/[^\d]/g, ""));
    if (isNaN(numeroExtraido) || numeroExtraido <= 0) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Não consegui entender esse valor.\nEnvie apenas o número, como *1000*."
      );
    }

    const { mensagem, texto, data, dia } = ctx.dados;
    const mensagemFinal = mensagem ?? texto;

    if (!mensagemFinal) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "⚠️ Não encontrei o texto do lembrete. Vamos começar de novo?"
      );
    }

    // 🟢 Caso A: já temos uma data textual completa → tenta salvar direto
    if (data && !dia) {
      const dataConvertida = parseDataPtBr(data);

      if (dataConvertida) {
        await LembreteRepository.criar({
          usuarioId,
          mensagem: mensagemFinal,
          dataAlvo: dataConvertida,
          valor: numeroExtraido
        });

        await ContextoRepository.limpar(telefone);

        return EnviadorWhatsApp.enviar(
          telefone,
          `🔔 Lembrete criado: *${mensagemFinal}* em *${dataConvertida.toLocaleDateString("pt-BR")}* (R$ ${numeroExtraido}).`
        );
      }

      // não entendeu a data → pergunta a data de novo
      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_data",
        dados: { mensagem: mensagemFinal, valor: numeroExtraido }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "📅 Agora me diga a data do lembrete. Ex: *10/02* ou *amanhã*."
      );
    }

    // 🟢 Caso B: só tínhamos o DIA (ex: "dia 1" → dia = 1)
    if (dia) {
      await ContextoRepository.salvar(telefone, {
        etapa: "complementar_mes_lembrete",
        dados: {
          mensagem: mensagemFinal,
          dia,
          valor: numeroExtraido
        }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        `📅 Entendi! É dia *${dia}* de qual mês? (Ex: *12* ou *dezembro*).`
      );
    }

    // 🟢 Caso C: não tinha data nenhuma → segue fluxo clássico pedindo data
    await ContextoRepository.salvar(telefone, {
      etapa: "criando_lembrete_data",
      dados: {
        mensagem: mensagemFinal,
        valor: numeroExtraido
      }
    });

    return EnviadorWhatsApp.enviar(
      telefone,
      "📅 Perfeito! Agora me diga a data do lembrete.\nEx: *10/02* ou *amanhã*."
    );
  }

  /**
   * Fluxo novo — complementar o mês quando o usuário informou só "dia 1"
   * na frase inicial.
   *
   * Aqui o usuário pode mandar:
   *  - "12"            → mês 12
   *  - "dezembro"      → mês 12
   *  - "1/12" ou "01/12" → data COMPLETA (tratamos separado)
   */
  static async salvarMes(telefone: string, mesMsg: string, usuarioId: string) {
    const ctx = await ContextoRepository.obter(telefone);

    if (!ctx || !ctx.dados || !ctx.dados.dia || !ctx.dados.mensagem) {
      await ContextoRepository.limpar(telefone);
      return EnviadorWhatsApp.enviar(
        telefone,
        "⚠️ Não consegui recuperar o lembrete anterior. Vamos começar de novo?"
      );
    }

    const { dia, mensagem, valor } = ctx.dados;

    // 🔥 1º TENTATIVA: o usuário pode ter mandado uma DATA COMPLETA aqui, tipo "1/12"
    const dataCompleta = parseDataPtBr(mesMsg);
    if (dataCompleta) {
      await LembreteRepository.criar({
        usuarioId,
        mensagem,
        dataAlvo: dataCompleta,
        valor: valor ?? null
      });

      await ContextoRepository.limpar(telefone);

      return EnviadorWhatsApp.enviar(
        telefone,
        `🔔 Lembrete criado: *${mensagem}* em *${dataCompleta.toLocaleDateString("pt-BR")}*` +
        `${valor ? ` (R$ ${valor})` : ""}.`
      );
    }

    // 2ª TENTATIVA: interpretar APENAS o mês (12, dezembro, dez, etc.)
    const mes = normalizarMes(mesMsg);
    if (mes === null) {
      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Não consegui entender o mês. Tente algo como *12* ou *dezembro*."
      );
    }

    const hoje = new Date();
    let ano = hoje.getFullYear();
    let data = new Date(ano, mes, dia);

    // se essa data já passou este ano, joga para o próximo
    if (data < hoje) {
      ano += 1;
      data = new Date(ano, mes, dia);
    }

    await LembreteRepository.criar({
      usuarioId,
      mensagem,
      dataAlvo: data,
      valor: valor ?? null
    });

    await ContextoRepository.limpar(telefone);

    return EnviadorWhatsApp.enviar(
      telefone,
      `🔔 Lembrete criado: *${mensagem}* em *${data.toLocaleDateString("pt-BR")}*` +
      `${valor ? ` (R$ ${valor})` : ""}.`
    );
  }
}



