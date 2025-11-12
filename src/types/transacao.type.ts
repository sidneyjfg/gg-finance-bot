import type { TipoTransacao } from "./categoria.type";

export interface Transacao {
  id: string; // UUID
  usuarioId: string;
  categoriaId?: string | null;
  tipo: TipoTransacao;
  valor: number; // decimal(10,2)
  descricao?: string | null;
  data: Date;
  recorrente: boolean;
  criadoEm: Date;
}
