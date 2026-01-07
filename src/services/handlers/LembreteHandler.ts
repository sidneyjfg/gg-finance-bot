import { LembreteRepository } from "../../repositories/lembrete.repository";
import { ContextoRepository } from "../../repositories/contexto.repository";
import { EnviadorWhatsApp } from "../EnviadorWhatsApp";
import { extrairDiaSimples, normalizarMes, parseDataPtBr } from "../../utils/parseDatabr";
import { extrairMesEAno } from "../../utils/periodo";

export class LembreteHandler {

  /**
   * Tenta interpretar a data tanto em formato pt-BR ("20/11", "amanhã")
   * quanto em formato ISO ("2023-12-21") que vem da IA.
   */
  private static parseDataInteligente(dataStr: string): Date | null {
    if (!dataStr) return null;

    // 1) Primeiro tenta o parser pt-BR já existente
    const pt = parseDataPtBr(dataStr);
    if (pt) return pt;

    // 2) Se não rolou, tenta ISO (YYYY-MM-DD ou parecido)
    const isoMatch = dataStr.match(/^\d{4}-\d{2}-\d{2}/);
    if (isoMatch) {
      const d = new Date(dataStr);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }

    return null;
  }

  static async iniciar(
    telefone: string,
    usuarioId: string,
    mensagem: string | null,
    data: string | null,
    valor: number | null = null
  ) {

    // ✅ Caso ideal: IA já mandou mensagem + data + valor
    if (mensagem && data && valor !== null) {
      return this.salvarCompletoComParse(telefone, usuarioId, mensagem, data, valor);
    }

    // Mensagem + valor, mas sem data → pedir só a data
    if (mensagem && valor !== null && !data) {
      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_data",
        dados: { mensagem, valor }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "📅 Falta a data. Quando devo te lembrar disso?"
      );
    }

    // Mensagem + data, mas sem valor → pedir valor
    if (mensagem && data && valor === null) {
      const apenasDia = extrairDiaSimples(data);

      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_valor",
        dados: { mensagem, data, dia: apenasDia }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "💰 Qual o valor desse lembrete?"
      );
    }

    // Só mensagem → pedir data
    if (mensagem && !data) {
      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_data",
        dados: { mensagem, valor }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "📅 Quando devo te lembrar? Ex: 20/11 ou amanhã."
      );
    }

    // Só data → pedir texto
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

    // Nada ainda → começar pedindo o texto
    await ContextoRepository.salvar(telefone, {
      etapa: "criando_lembrete_texto"
    });

    return EnviadorWhatsApp.enviar(
      telefone,
      "💭 O que você quer que eu te lembre?"
    );
  }


  private static async salvarCompletoComParse(
    telefone: string,
    usuarioId: string,
    mensagem: string,
    dataStr: string,
    valor: number | null
  ) {
    // 🔑 AGORA usa o parser inteligente (pt-BR ou ISO)
    const data = this.parseDataInteligente(dataStr);

    if (!data) {
      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_data",
        dados: { mensagem, valor }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        "❌ Não consegui entender a data."
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
      `🔔 Vou te lembrar: *${mensagem}* em *${data.toLocaleDateString("pt-BR")}*`
    );
  }

  static async salvarTexto(telefone: string, texto: string) {
    await ContextoRepository.atualizarDados(telefone, { texto });

    await ContextoRepository.salvar(telefone, {
      etapa: "criando_lembrete_data",
      dados: { texto }
    });

    return EnviadorWhatsApp.enviar(
      telefone,
      "📆 Quando devo te lembrar? (Ex: 20/11)"
    );
  }


  static async salvarData(telefone: string, dataMsg: string, usuarioId: string) {
    const ctx = await ContextoRepository.obter(telefone);
    const dados = ctx?.dados as {
      mensagem?: string;
      texto?: string;
      valor?: number | null;
    };

    const texto = dados?.mensagem ?? dados?.texto ?? null;
    const valor = dados?.valor ?? null;

    if (!texto) {
      return EnviadorWhatsApp.enviar(telefone, "⚠️ Texto não encontrado.");
    }

    // 🔑 Aqui também passa a usar o parser inteligente
    const data = this.parseDataInteligente(dataMsg);
    if (!data) {
      return EnviadorWhatsApp.enviar(telefone, "❌ Data inválida.");
    }

    await LembreteRepository.criar({
      usuarioId,
      mensagem: texto,
      dataAlvo: data,
      valor
    });

    await ContextoRepository.limpar(telefone);

    return EnviadorWhatsApp.enviar(telefone, "⏰ Lembrete criado!");
  }


  static async salvarValor(telefone: string, valorMsg: string, usuarioId: string) {
    const ctx = await ContextoRepository.obter(telefone);
    const dados = ctx?.dados as {
      mensagem?: string;
      texto?: string;
      data?: string;
      dia?: number;
    };

    if (!dados) {
      await ContextoRepository.limpar(telefone);
      return EnviadorWhatsApp.enviar(telefone, "⚠️ Nada encontrado.");
    }

    const valor = Number(valorMsg.replace(/[^\d]/g, ""));
    if (isNaN(valor) || valor <= 0) {
      return EnviadorWhatsApp.enviar(telefone, "❌ Valor inválido.");
    }

    const mensagemFinal = dados.mensagem ?? dados.texto;

    if (!mensagemFinal) {
      return EnviadorWhatsApp.enviar(telefone, "⚠️ Texto do lembrete não encontrado.");
    }

    if (dados.data && !dados.dia) {
      // 🔑 Usa o parser inteligente para a data salva no contexto
      const parsed = this.parseDataInteligente(dados.data);

      if (parsed) {
        await LembreteRepository.criar({
          usuarioId,
          mensagem: mensagemFinal,
          dataAlvo: parsed,
          valor
        });

        await ContextoRepository.limpar(telefone);

        return EnviadorWhatsApp.enviar(
          telefone,
          `🔔 Lembrete criado: *${mensagemFinal}*`
        );
      }

      await ContextoRepository.salvar(telefone, {
        etapa: "criando_lembrete_data",
        dados: { mensagem: mensagemFinal, valor }
      });

      return EnviadorWhatsApp.enviar(telefone, "📅 Informe a data do lembrete.");
    }

    if (dados.dia) {
      await ContextoRepository.salvar(telefone, {
        etapa: "complementar_mes_lembrete",
        dados: { mensagem: mensagemFinal, dia: dados.dia, valor }
      });

      return EnviadorWhatsApp.enviar(
        telefone,
        `📅 Certo! Dia *${dados.dia}* de qual mês?`
      );
    }

    await ContextoRepository.salvar(telefone, {
      etapa: "criando_lembrete_data",
      dados: { mensagem: mensagemFinal, valor }
    });

    return EnviadorWhatsApp.enviar(telefone, "📅 Informe a data do lembrete.");
  }


  static async salvarMes(telefone: string, mesMsg: string, usuarioId: string) {

    const ctx = await ContextoRepository.obter(telefone);
    const dados = ctx?.dados as { dia?: number; mensagem?: string; valor?: number | null };

    if (!dados?.dia || !dados?.mensagem) {
      await ContextoRepository.limpar(telefone);
      return EnviadorWhatsApp.enviar(telefone, "⚠️ Não encontrei o lembrete anterior.");
    }

    const { dia, mensagem, valor } = dados;

    // 🔑 Primeiro tenta se o usuário mandou uma data completa ("20/11/2025")
    const dataCompleta = this.parseDataInteligente(mesMsg);
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
        `🔔 Lembrete criado: *${mensagem}*`
      );
    }

    // Se não for uma data completa, interpreta só o mês ("novembro", "11")
    // ✅ NOVO: entende "desse mês", "mês passado", "mês 9", "novembro 2025"...
    const mesAno = extrairMesEAno(mesMsg);

    let mesIndex: number | null = null; // 0..11
    let anoFinal: number | null = null;

    if (mesAno) {
      // extrairMesEAno retorna mes 1..12
      mesIndex = mesAno.mes - 1;
      anoFinal = mesAno.ano;
    } else {
      // fallback antigo: interpreta só o mês ("novembro", "11")
      mesIndex = normalizarMes(mesMsg); 
      if (mesIndex === null) {
        return EnviadorWhatsApp.enviar(
          telefone,
          "❌ Não entendi o mês. Ex: *desse mês*, *mês passado* ou *janeiro*."
        );
      }
      anoFinal = new Date().getFullYear();
    }

    // Monta a data com o dia do contexto
    const hoje = new Date();
    let data = new Date(anoFinal, mesIndex, dia);

    // ✅ Regra: se usuário disse explicitamente "mês passado", não joga pro ano seguinte.
    // (extrairMesEAno já devolve o ano certo, então aqui só ajusta quando veio do fallback)
    if (!mesAno) {
      // fallback antigo: se ficou no passado, joga pro ano seguinte
      if (data < hoje) {
        data = new Date(anoFinal + 1, mesIndex, dia);
      }
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
      `🔔 Lembrete criado para ${data.toLocaleDateString("pt-BR")}!`
    );
  }
}
