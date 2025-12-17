// src/utils/periodo.utils.ts

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// meses agora são 1..12 (humano)
const meses: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

export function extrairMesEAno(mensagem: string): { mes: number; ano: number } | null {
  const txt = normalizar(mensagem);
  const hoje = new Date();

  // ✅ esse mês / mês atual / neste mês
  if (/\b(esse|este|neste)\s+mes\b|\bmes\s+atual\b/.test(txt)) {
    return { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() };
  }

  // ✅ mês passado
  if (/\bmes\s+passad[oa]\b/.test(txt)) {
    const dt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return { mes: dt.getMonth() + 1, ano: dt.getFullYear() };
  }

  // ✅ mês retrasado
  if (/\bmes\s+retrasad[oa]\b/.test(txt)) {
    const dt = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
    return { mes: dt.getMonth() + 1, ano: dt.getFullYear() };
  }

  // ✅ "mês 11" / "mes 11" (e aceita "mes11")
  const matchNumero = txt.match(/\bmes\s*(\d{1,2})\b/);
  if (matchNumero) {
    const mesNum = Number(matchNumero[1]);
    if (mesNum >= 1 && mesNum <= 12) {
      const anoMatch = txt.match(/\b(20\d{2})\b/);
      const ano = anoMatch ? Number(anoMatch[1]) : hoje.getFullYear();
      return { mes: mesNum, ano };
    }
  }

  // ✅ nome do mês (novembro/dezembro/etc.)
  const mesEncontrado = Object.keys(meses).find((m) =>
    new RegExp(`\\b${m}\\b`, "i").test(txt)
  );
  if (!mesEncontrado) return null;

  // ✅ ano explícito (ex: "novembro 2025")
  const anoMatch = txt.match(/\b(20\d{2})\b/);
  const ano = anoMatch ? Number(anoMatch[1]) : hoje.getFullYear();

  return { mes: meses[mesEncontrado], ano };
}

// ✅ intervalo com fim EXCLUSIVO (primeiro dia do próximo mês)
// recebe mes 1..12
export function intervaloMes(mes: number, ano: number) {
  const inicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
  const fim = new Date(ano, mes, 1, 0, 0, 0, 0); // próximo mês (EXCLUSIVO)
  return { inicio, fim };
}
