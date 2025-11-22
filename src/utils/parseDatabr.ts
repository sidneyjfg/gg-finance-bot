/* ===========================
   HELPERS DE DATA
   =========================== */

/**
 * Converte datas em português em um objeto Date.
 * Suporta:
 *  - "amanhã"
 *  - "dia 1", "1", "no dia 5"
 *  - "dia 5 do mês que vem"
 *  - "10/02", "10-02", "10/02/2025"
 *  - "5 de março", "5 de marco"
 */
export function parseDataPtBr(texto: string): Date | null {
    if (!texto) return null;
    texto = texto.toLowerCase().trim();

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();

    // "amanhã"
    if (texto === "amanhã" || texto === "amanha") {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d;
    }

    // "dia 1", "1", "no dia 5" (sem mês explícito)
    const diaSimples = extrairDiaSimples(texto);
    if (diaSimples !== null && !texto.includes("mês que vem") && !texto.includes("mes que vem")) {
        const data = new Date(anoAtual, mesAtual, diaSimples);
        if (data < hoje) {
            data.setMonth(data.getMonth() + 1);
        }
        return data;
    }

    // “dia 5 do mês que vem”, “5 mês que vem”
    const mProxMes = texto.match(/(?:dia\s+)?(\d{1,2}).*(m[eê]s que vem|pr[oó]ximo m[eê]s)/);
    if (mProxMes) {
        const dia = Number(mProxMes[1]);
        return new Date(anoAtual, mesAtual + 1, dia);
    }

    // dd/mm ou dd-mm
    const m1 = texto.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (m1) {
        const dia = Number(m1[1]);
        const mes = Number(m1[2]) - 1;
        let ano = anoAtual;
        let data = new Date(ano, mes, dia);
        if (data < hoje) ano++;
        data = new Date(ano, mes, dia);
        return data;
    }

    // dd/mm/aaaa
    const m2 = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m2) {
        const dia = Number(m2[1]);
        const mes = Number(m2[2]) - 1;
        const ano = Number(m2[3]);
        return new Date(ano, mes, dia);
    }

    // dia + mês por extenso (ex: "5 de março")
    const mesesMap: Record<string, number> = {
        janeiro: 0, fevereiro: 1, março: 2, marco: 2, abril: 3, maio: 4, junho: 5,
        julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
    };

    const m3 = texto.match(/(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?/);
    if (m3) {
        const dia = Number(m3[1]);
        const mesNome = m3[2];
        const ano = m3[3] ? Number(m3[3]) : anoAtual;
        const mes = mesesMap[mesNome];
        if (mes === undefined) return null;

        let data = new Date(ano, mes, dia);

        // se não informou ano e a data já passou, joga para o ano que vem
        if (!m3[3] && data < hoje) {
            data.setFullYear(ano + 1);
        }

        return data;
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