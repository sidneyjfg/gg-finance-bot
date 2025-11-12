export type Frequencia = "diaria" | "semanal" | "mensal" | "anual";

export interface Recorrencia {
  id: string; // UUID
  usuarioId: string;
  transacaoId: string;
  frequencia: Frequencia;
  intervalo: number;
  proximaCobranca: Date;
}
