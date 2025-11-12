export interface Relatorio {
  id: string; // UUID
  usuarioId: string;
  mes: string; // formato YYYY-MM
  totalReceitas: number; // decimal
  totalDespesas: number; // decimal
  saldo: number; // decimal
  criadoEm: Date;
}
