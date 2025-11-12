export interface LogBot {
  id: string; // UUID
  usuarioId: string;
  intencao: string;
  mensagem: string;
  criadoEm: Date;
}
