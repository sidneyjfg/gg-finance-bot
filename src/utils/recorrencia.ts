import { Frequencia, RegraMensal } from "@prisma/client";

function isDiaUtil(date: Date) {
  const d = date.getDay(); // 0 dom, 6 sab
  return d !== 0 && d !== 6;
}

function nthDiaUtilDoMes(ano: number, mesIndex: number, n: number) {
  let count = 0;

  for (let dia = 1; dia <= 31; dia++) {
    const dt = new Date(ano, mesIndex, dia);
    if (dt.getMonth() !== mesIndex) break;

    if (isDiaUtil(dt)) {
      count++;
      if (count === n) return dt;
    }
  }

  // fallback: último dia útil do mês
  for (let dia = 31; dia >= 1; dia--) {
    const dt = new Date(ano, mesIndex, dia);
    if (dt.getMonth() !== mesIndex) continue;
    if (isDiaUtil(dt)) return dt;
  }

  // último fallback
  return new Date(ano, mesIndex + 1, 1);
}

/**
 * Calcula a próxima cobrança com base em:
 * - Frequência (diaria, semanal, mensal, anual)
 * - Regra mensal (dia do mês ou n-ésimo dia útil)
 *
 * OBS: "dia útil" aqui é seg-sex (sem feriados). Depois você pode evoluir.
 */
export function calcularProximaCobranca(params: {
  frequencia: Frequencia;
  regraMensal?: RegraMensal | null;
  diaDoMes?: number | null;
  nDiaUtil?: number | null;
  intervalo?: number | null;
  base?: Date;
}): Date {
  const base = params.base ?? new Date();
  const intervalo = params.intervalo ?? 1;

  if (params.frequencia === "diaria") {
    const d = new Date(base);
    d.setDate(d.getDate() + 1 * intervalo);
    return d;
  }

  if (params.frequencia === "semanal") {
    const d = new Date(base);
    d.setDate(d.getDate() + 7 * intervalo);
    return d;
  }

  if (params.frequencia === "anual") {
    return new Date(base.getFullYear() + 1 * intervalo, base.getMonth(), base.getDate());
  }

  // mensal
  const ano = base.getFullYear();
  const mes = base.getMonth();

  const calculaNoMes = (anoCalc: number, mesCalc: number) => {
    if (params.regraMensal === "N_DIA_UTIL") {
      const n = params.nDiaUtil ?? 1;
      return nthDiaUtilDoMes(anoCalc, mesCalc, n);
    }

    // padrão: DIA_DO_MES
    const dia = params.diaDoMes ?? base.getDate();
    return new Date(anoCalc, mesCalc, dia);
  };

  // tenta no mês atual
  let candidato = calculaNoMes(ano, mes);

  // se já passou, vai pro próximo mês considerando intervalo
  if (candidato <= base) {
    candidato = calculaNoMes(ano, mes + 1 * intervalo);
  }

  return candidato;
}
