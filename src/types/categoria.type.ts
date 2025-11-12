export type TipoTransacao = "receita" | "despesa";

export interface Categoria {
  id: string; // UUID
  usuarioId: string;
  nome: string;
  tipo: TipoTransacao;
  icone?: string | null;
  cor?: string | null;
  criadoEm: Date;
}
