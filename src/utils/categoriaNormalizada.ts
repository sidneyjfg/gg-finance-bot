// src/utils/categoriaNormalizada.ts

function normalizarTexto(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Tenta inferir uma categoria genérica a partir da descrição e/ou texto vindo da IA.
 *
 * tipo:
 *  - "receita"  → vai priorizar categorias de entrada de dinheiro
 *  - "despesa"  → vai priorizar categorias de gastos
 *
 * Retorna:
 *  - Nome da categoria que você vai salvar no banco (string)
 *  - ou null, se não conseguir inferir nada (aí você cai em "Outras receitas/despesas")
 */
export function inferirCategoriaPadrao(
  tipo: "receita" | "despesa",
  descricao?: string | null,
  categoriaTexto?: string | null
): string | null {
  const base =
    (categoriaTexto && categoriaTexto.trim().length > 0
      ? categoriaTexto
      : descricao || ""
    );

  if (!base) return null;

  const txt = normalizarTexto(base);

  // ===================== RECEITAS =====================
  if (tipo === "receita") {
    // 💼 Salário, pró-labore, serviços, freelas, consultoria
    if (
      /\b(salario|sal[aá]rio|pro labore|pro-labore|freela|freelancer|bico|consultoria|servico|servi[cç]o|honorario|honor[aá]rio|trabalho|hora extra|13|decimo terceiro|13o|comissao|comiss[aã]o)\b/.test(
        txt
      )
    ) {
      return "Receita com serviços"; // ou "Salário / Serviços"
    }

    // 💰 Receitas financeiras: juros, rendimento de aplicações, dividendos
    if (
      /\b(juros|rendimento|rendimentos|aplicacao|aplicac[oõ]es|investimento|cdb|tesouro|poupanca|poupan[cç]a|selic|lci|lca|fundo|dividendo|dividendos)\b/.test(
        txt
      )
    ) {
      return "Receita com aplicações financeiras";
    }

    // 📈 Recebimento de empréstimo, aporte, capital entrando
    if (
      /\b(emprestimo|empr[eé]stimo|aporte|capital|investidor|socio|s[oó]cio|entrada de dinheiro|aporte de capital)\b/.test(
        txt
      )
    ) {
      return "Outras receitas"; // poderia ser "Aportes e empréstimos recebidos"
    }

    // 🔁 Antecipação / boletos / financeiro
    if (
      /\b(antecipacao|antecipa[cç][aã]o|boleto|boletos|duplicata|adiantamento)\b/.test(
        txt
      )
    ) {
      return "Receita com Antecipação de Boletos";
    }

    // consultoria bem explícita
    if (/\b(consultoria|mentoria|assessoria)\b/.test(txt)) {
      return "Receita de Consultoria";
    }

    // fallback: receita genérica
    return "Outras receitas";
  }

  // ===================== DESPESAS =====================
  // Daqui pra baixo, tipo === "despesa"

  // 🍔 Alimentação (mercado, ifood, restaurante, lanche etc.)
  if (
    /\b(mercado|supermercado|super mercado|hortifruti|feira|a[cç]ougue|padaria|ifood|i food|rappi|ubereats|uber eats|lanch(e|onete)|lanche|hamburguer|hamb[uú]rguer|pizza|restaurante|bar|comida|almo[cç]o|janta|delivery)\b/.test(
      txt
    )
  ) {
    return "Alimentação";
  }

  // 🚗 Transporte (gasolina, uber, ônibus, estacionamento etc.)
  if (
    /\b(gasolina|etanol|alcool|álcool|diesel|posto|ipiranga|shell|uber|99|cabify|onibus|[oô]nibus|metro|metr[oô]|trem|passagem|corrida|taxi|t[aá]xi|estacionamento|pedagio|ped[aá]gio|vale transporte|vt)\b/.test(
      txt
    )
  ) {
    return "Transporte";
  }

  // 🏠 Moradia: aluguel, condomínio, IPTU, luz, água
  if (
    /\b(aluguel|aluguel casa|aluguel ap|condominio|condom[inio]|iptu|aluguel e condominio)\b/.test(
      txt
    )
  ) {
    return "Aluguel e condomínio";
  }

  if (
    /\b(luz|energia|enel|cemig|copel|eletropaulo|cear[aá]|conta de luz)\b/.test(
      txt
    )
  ) {
    return "Luz";
  }

  if (
    /\b(agua|água|cagece|sabesp|sanepar|saneamento|conta de agua|conta de [aá]gua)\b/.test(
      txt
    )
  ) {
    return "Água";
  }

  // 🌐 Telefone e internet
  if (
    /\b(telefone|celular|claro|vivo|tim|oi|nextel|internet|wifi|wi-fi|banda larga|net virtua|gvt)\b/.test(
      txt
    )
  ) {
    return "Telefone e Internet";
  }

  // 💳 Despesas financeiras / tarifas / juros
  if (
    /\b(tarifa bancaria|tarifa banc[aá]ria|tarifa|cesta de servicos|cesta de servi[cç]os|juros|juros cartao|rotativo|iof|tarifa bank|taxa bancaria|anuidade|tarifa pix|despesas financeiras|despesa financeira)\b/.test(
      txt
    )
  ) {
    return "Despesas financeiras";
  }

  // 🏦 Impostos e contribuições (IR, INSS, ISS, CSRF, taxas)
  if (
    /\b(irrf|irpf|imposto de renda|imposto|darf|das|mei|iss|inss|csrf|csll|pis|cofins|taxa|taxas e contribuicoes|contribuicao)\b/.test(
      txt
    )
  ) {
    return "Taxas e contribuições";
  }

  // 🩺 Saúde: plano, exames, farmácia
  if (
    /\b(plano de saude|plano de saúde|unimed|amil|hapvida|sulamerica|sul am[eé]rica|farmacia|farmácia|remedio|rem[eé]dio|medicamento|consulta|exame|laboratorio|laborat[oó]rio|dentista|odontologia|psic[oó]logo)\b/.test(
      txt
    )
  ) {
    // se falar muito de plano => "Plano de Saúde"
    if (/\b(plano de saude|plano de saúde|unimed|amil|hapvida|sulamerica|sul am[eé]rica)\b/.test(txt)) {
      return "Plano de Saúde";
    }
    if (/\b(exame|consulta|laboratorio|laborat[oó]rio)\b/.test(txt)) {
      return "Exames";
    }
    return "Saúde";
  }

  // 🎓 Educação: cursos, treinamentos, faculdade
  if (
    /\b(curso|cursos|treinamento|treinamentos|faculdade|universidade|escola|colegio|col[eé]gio|pos graduacao|p[oó]s gradua[cç][aã]o|p[oó]s|mba|material escolar)\b/.test(
      txt
    )
  ) {
    return "Cursos e Treinamentos";
  }

  // 💻 Software, SAAS, assinaturas não-streaming
  if (
    /\b(office365|office 365|microsoft 365|microsoft office|google drive|google workspace|g suite|gsuite|onedrive|dropbox|notion|trello|clickup|slack|zoom|nibo|contabilizei|totvs|software|assinatura de software)\b/.test(
      txt
    )
  ) {
    return "Software";
  }

  // 🎵 Streaming / entretenimento digital
  if (
    /\b(spotify|netflix|disney\+?|disney plus|prime video|primevideo|hbo|max|youtube premium|apple music|deezer|star\+?)\b/.test(
      txt
    )
  ) {
    return "Streaming";
  }

  // 🖨️ / 💼 Material de escritório, impressoras, notebooks
  if (
    /\b(papelaria|caneta|lapis|l[aá]pis|caderno|impressora|cartucho|toner|tinta impressora|notebook|laptop|computador|desktop|mouse|teclado|material de escritorio|material de escritório)\b/.test(
      txt
    )
  ) {
    if (/\b(notebook|laptop|computador|desktop)\b/.test(txt)) {
      return "Locação de Notebook";
    }
    if (/\b(impressora|cartucho|toner|tinta impressora)\b/.test(txt)) {
      return "Locação de Impressoras";
    }
    return "Material de escritório";
  }

  // 👔 Trabalho / salários / benefícios (do ponto de vista PF: pode ser empregado doméstico, diarista etc.)
  if (
    /\b(salarios|encargos|beneficios|vale refeicao|vale-refeicao|vr|vale alimentacao|vale-alimenta[cç][aã]o|vale transporte|vale-transporte|vt|folha de pagamento)\b/.test(
      txt
    )
  ) {
    // se falar de VR/Vale refeição
    if (/\b(vr|vale refeicao|vale-refeicao)\b/.test(txt)) {
      return "Vale refeição";
    }
    if (/\b(vt|vale transporte|vale-transporte)\b/.test(txt)) {
      return "Vale Transporte";
    }
    return "Salários, encargos e benefícios";
  }

  // 🎉 Festas, comemorações, lazer mais "social"
  if (
    /\b(festa|festas|comemorac[aã]o|comemora[cç][aã]o|aniversario|anivers[aá]rio|balada|show|evento|churrasco|encontro|role|rol[eê]|happy hour|brinde|brindes|presentes)\b/.test(
      txt
    )
  ) {
    if (/\b(brinde|brindes|presente|presentes)\b/.test(txt)) {
      return "Brindes";
    }
    return "Festas e Comemorações";
  }

  // 🚗 Estacionamento, multas, pedágio (se não caiu antes em transporte)
  if (/\b(multa|multas|radar|infra[cç][aã]o)\b/.test(txt)) {
    return "Multas";
  }

  if (/\b(estacionamento)\b/.test(txt)) {
    return "Estacionamento";
  }

  // 🧾 Serviços contratados em geral
  if (
    /\b(servico contratado|servi[cç]o contratado|servicos contratados|servi[cç]os contratados|faxina|diarista|jardineiro|manuten[cç][aã]o|conserto|reparo)\b/.test(
      txt
    )
  ) {
    return "Serviços contratados";
  }

  // 🛡️ Seguros
  if (
    /\b(seguro|seguro de vida|seguro carro|seguro auto|seguro residencial|apolice|ap[oó]lice)\b/.test(
      txt
    )
  ) {
    return "Seguro";
  }

  // 🧑‍⚖️ Assessoria jurídica, advogado
  if (
    /\b(advogado|advocacia|assessoria juridica|assessoria jur[ií]dica|escritorio de advocacia)\b/.test(
      txt
    )
  ) {
    return "Assessoria Jurídica";
  }

  // 💻 Servidor, hospedagem
  if (
    /\b(servidor|hospedagem|cloud|vps|aws|azure|google cloud|locacao de servidor|loca[cç][aã]o de servidor)\b/.test(
      txt
    )
  ) {
    return "Locação de servidor";
  }

  // 🏦 Empréstimos (pagamento)
  if (
    /\b(pagamento de emprestimo|pagar emprestimo|parcela emprestimo|parcela do emprestimo|financiamento|parcelas financiamento)\b/.test(
      txt
    )
  ) {
    return "Pagamento de empréstimo";
  }

  // 👨‍👩‍👧 Família (presentes/ajuda pra parentes)
  if (
    /\b(mae|m[aã]e|pai|filho|filha|esposa|marido|namorada|namorado|familia|fam[ií]lia|sogra|sogro|enteado|enteada)\b/.test(
      txt
    )
  ) {
    return "Família";
  }

  // Não bateu em nada mais específico → deixa cair numa categoria genérica
  return null;
}
