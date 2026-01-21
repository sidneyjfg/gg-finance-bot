function somarDias(dataBase: Date, quantidadeDias: number): Date {
    const d = new Date(dataBase);
    d.setDate(d.getDate() + quantidadeDias);
    return d;
}

/**
 * Soma meses sem "estourar" (ex: 31/01 + 1 mês => 28/02)
 */
function somarMesesComLimite(dataBase: Date, quantidadeMeses: number): Date {
    const d = new Date(dataBase);
    const diaOriginal = d.getDate();

    // vai pro dia 1 pra evitar overflow de mês
    d.setDate(1);
    d.setMonth(d.getMonth() + quantidadeMeses);

    // último dia do mês alvo
    const ultimoDiaMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(diaOriginal, ultimoDiaMes));

    return d;
}

function somarAnosComLimite(dataBase: Date, quantidadeAnos: number): Date {
    return somarMesesComLimite(dataBase, quantidadeAnos * 12);
}

/**
 * Entende:
 * - "daqui 5 dias" / "daqui a 5 dias"
 * - "em 5 dias"
 * - "dentro de 5 dias"
 * - "após 5 dias"
 * - "daqui 2 semanas"
 * - "em 3 meses"
 * - "daqui 1 ano"
 * - "daqui 5" (sem unidade => dias)
 */
function interpretarDataRelativaPtBr(textoChave: string, hoje: Date): Date | null {
    const m = textoChave.match(
        /\b(?:daqui|daq|dq|em|dentro\s+de|apos)\s*(?:a\s*)?(\d{1,4})\s*(dia|dias|semana|semanas|mes|meses|ano|anos)?(?:\s+uteis)?\b/
    );

    if (!m) return null;

    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return null;

    const unidade = (m[2] ?? "dias").toLowerCase(); // sem unidade => dias

    if (unidade === "dia" || unidade === "dias") return somarDias(hoje, n);
    if (unidade === "semana" || unidade === "semanas") return somarDias(hoje, n * 7);
    if (unidade === "mes" || unidade === "meses") return somarMesesComLimite(hoje, n);
    if (unidade === "ano" || unidade === "anos") return somarAnosComLimite(hoje, n);

    return null;
}


export function parseDataPtBr(texto: string): Date | null {
    if (!texto) return null;

    // minúsculo + trim
    let t = texto.toLowerCase().trim();

    // ✅ remove caracteres invisíveis comuns do WhatsApp + acentos combinantes (amanhã etc.)
    t = t
        .replace(/\u00a0/g, " ")                 // NBSP
        .replace(/[\u200b-\u200d\uFEFF]/g, "")   // zero-width chars
        .replace(/[\u202a-\u202e]/g, "")         // directional marks
        .replace(/[\u0300-\u036f]/g, "");        // acentos combinantes

    console.log("RAW:", JSON.stringify(texto));
    console.log("LOW:", JSON.stringify(texto.toLowerCase().trim()));

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();

    // ✅ chave sem acentos (além dos combinantes já removidos)
    const textoChave = t
        .replace(/[áàâãä]/g, "a")
        .replace(/[éèêë]/g, "e")
        .replace(/[íìîï]/g, "i")
        .replace(/[óòôõö]/g, "o")
        .replace(/[úùûü]/g, "u")
        .replace(/[ç]/g, "c");

    // ✅ "hoje"
    if (/\bhoje\b/.test(textoChave)) {
        const dataExplicita = extrairDataNumericaDeTexto(t, anoAtual, hoje);
        if (dataExplicita) return dataExplicita;

        // garante data "zerada" no dia de hoje (sem depender de hora)
        return new Date(anoAtual, mesAtual, hoje.getDate());
    }

    // ✅ "depois de amanhã" ANTES de "amanhã"
    // evita cair no match de "amanhã" dentro da frase
    if (/\bdepois\s+de\s+amanha\b/.test(textoChave)) {
        const dataExplicita = extrairDataNumericaDeTexto(t, anoAtual, hoje);
        if (dataExplicita) return dataExplicita;

        return somarDias(hoje, 2);
    }

    // ✅ "amanhã/amanha"
    if (/\bamanha\b/.test(textoChave) || /\bamanhã\b/.test(t)) {
        const dataExplicita = extrairDataNumericaDeTexto(t, anoAtual, hoje);
        if (dataExplicita) return dataExplicita;

        return somarDias(hoje, 1);
    }

    const dataRelativa = interpretarDataRelativaPtBr(textoChave, hoje);
    if (dataRelativa) return dataRelativa;

    const dataNum = extrairDataNumericaDeTexto(t, anoAtual, hoje);
    if (dataNum) return dataNum;

    const diaSimples = extrairDiaSimplesFlex(t);
    if (diaSimples !== null && !t.includes("mes que vem") && !t.includes("mês que vem")) {
        const data = new Date(anoAtual, mesAtual, diaSimples);
        if (data < hoje) data.setMonth(data.getMonth() + 1);
        return data;
    }

    const mProxMes = t.match(/(?:dia\s+)?(\d{1,2}).*(mes que vem|m[eê]s que vem|proximo mes|pr[oó]ximo m[eê]s)/);
    if (mProxMes) {
        const dia = Number(mProxMes[1]);
        return new Date(anoAtual, mesAtual + 1, dia);
    }

    // “próximo mês dia 5”
    const mProxMes2 = t.match(/(proximo mes|pr[oó]ximo m[eê]s|mes que vem|m[eê]s que vem).*(?:dia\s+)?(\d{1,2})/);
    if (mProxMes2) {
        const dia = Number(mProxMes2[2]);
        return new Date(anoAtual, mesAtual + 1, dia);
    }

    // “dia 30 desse mês”, “30 do mês atual”
    const mMesAtual = t.match(/(?:dia\s+)?(\d{1,2}).*(desse mes|desse m[eê]s|do mes atual|do m[eê]s atual|mes atual|m[eê]s atual)/);
    if (mMesAtual) {
        const dia = Number(mMesAtual[1]);
        return new Date(anoAtual, mesAtual, dia);
    }

    const mesesMap: Record<string, number> = {
        janeiro: 0, fevereiro: 1, março: 2, marco: 2, abril: 3, maio: 4, junho: 5,
        julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
    };

    const m3 = t.match(/(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?/);
    if (m3) {
        const dia = Number(m3[1]);
        const mesNome = m3[2];
        const ano = m3[3] ? Number(m3[3]) : anoAtual;
        const mes = mesesMap[mesNome];
        if (mes === undefined) return null;

        let data = new Date(ano, mes, dia);
        if (!m3[3] && data < hoje) data.setFullYear(ano + 1);
        return data;
    }

    return null;
}

function extrairDataNumericaDeTexto(t: string, anoAtual: number, hoje: Date): Date | null {
    // ✅ 1) dd/mm/aa ou dd/mm/aaaa (prioridade)
    const m2 = t.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/);
    if (m2) {
        const dia = Number(m2[1]);
        const mes = Number(m2[2]) - 1;
        let ano = Number(m2[3]);

        if (ano < 100) ano = 2000 + ano;

        return new Date(ano, mes, dia);
    }

    // ✅ 2) dd/mm ou dd-mm (sem ano)
    const m1 = t.match(/(\d{1,2})[\/\-](\d{1,2})(?![\/\-]\d)/);
    if (m1) {
        const dia = Number(m1[1]);
        const mes = Number(m1[2]) - 1;
        let ano = anoAtual;

        let data = new Date(ano, mes, dia);
        if (data < hoje) ano++;
        data = new Date(ano, mes, dia);

        return data;
    }

    return null;
}

/**
 * Versão flexível do extrairDiaSimples:
 * pega "dia 21" mesmo dentro de frase
 */
function extrairDiaSimplesFlex(t: string): number | null {
    // tenta "dia 21" no meio do texto
    const m1 = t.match(/\bdia\s+(\d{1,2})\b/);
    if (m1) {
        const dia = Number(m1[1]);
        if (!isNaN(dia) && dia >= 1 && dia <= 31) return dia;
    }

    // tenta só número inteiro como texto limpo (caso ainda seja só "21")
    const m2 = t.match(/^(?:no dia\s+|dia\s+)?(\d{1,2})$/);
    if (m2) {
        const dia = Number(m2[1]);
        if (!isNaN(dia) && dia >= 1 && dia <= 31) return dia;
    }

    return null;
}

/**
 * Extrai um dia se o texto for algo como:
 *  - "dia 1"
 *  - "1"
 *  - "no dia 5"
 * e NÃO contém mês explícito nem "/".
 */
export function extrairDiaSimples(texto: string): number | null {
    texto = texto.toLowerCase().trim();

    // Se tiver mês por extenso ou "/", já não é "só dia"
    if (
        texto.includes("janeiro") || texto.includes("fevereiro") || texto.includes("março") ||
        texto.includes("marco") || texto.includes("abril") || texto.includes("maio") ||
        texto.includes("junho") || texto.includes("julho") || texto.includes("agosto") ||
        texto.includes("setembro") || texto.includes("outubro") || texto.includes("novembro") ||
        texto.includes("dezembro") || texto.includes("/")
    ) {
        return null;
    }

    const m = texto.match(/^(?:no dia\s+|dia\s+)?(\d{1,2})$/);
    if (!m) return null;

    const dia = Number(m[1]);
    if (isNaN(dia) || dia < 1 || dia > 31) return null;

    return dia;
}

/**
 * Normaliza um mês vindo como:
 *  - "12", "01"
 *  - "dezembro", "dez"
 * Retorna índice 0–11 ou null.
 */
export function normalizarMes(texto: string): number | null {
    if (!texto) return null;
    texto = texto.toLowerCase().trim();

    // número direto
    const num = Number(texto.replace(/[^\d]/g, ""));
    if (!isNaN(num) && num >= 1 && num <= 12) {
        return num - 1;
    }

    const map: Record<string, number> = {
        "jan": 0, "janeiro": 0,
        "fev": 1, "fevereiro": 1,
        "mar": 2, "março": 2, "marco": 2,
        "abr": 3, "abril": 3,
        "mai": 4, "maio": 4,
        "jun": 5, "junho": 5,
        "jul": 6, "julho": 6,
        "ago": 7, "agosto": 7,
        "set": 8, "setembro": 8,
        "out": 9, "outubro": 9,
        "nov": 10, "novembro": 10,
        "dez": 11, "dezembro": 11
    };

    if (map[texto] !== undefined) return map[texto];

    return null;
}
