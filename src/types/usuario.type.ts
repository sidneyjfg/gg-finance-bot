export interface Usuario {
  id: string; // UUID
  telefone: string;
  nome?: string | null;
  cpfCnpj?: string | null;
  criadoEm: Date;
}
