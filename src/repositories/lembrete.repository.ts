import { PrismaClient, Lembrete } from "@prisma/client";

const prisma = new PrismaClient();

export class LembreteRepository {

    // 🟢 Criar lembrete
    static async criar(dados: {
        usuarioId: string;
        mensagem: string;
        data?: string | null;
        valor?: number | null;
        dataAlvo?: Date | null;
    }): Promise<Lembrete> {

        // Normaliza a data final
        let dataFinal: Date | null = null;

        if (dados.dataAlvo instanceof Date) {
            dataFinal = dados.dataAlvo;
        } else if (dados.data) {
            const convertida = new Date(dados.data);
            if (!isNaN(convertida.getTime())) {
                dataFinal = convertida;
            }
        }

        // OBJETO CORRETO (sem undefined)
        const data: any = {
            usuarioId: dados.usuarioId,
            mensagem: dados.mensagem,
            enviado: false,
            valor: dados.valor ?? null
        };

        // Adiciona dataAlvo APENAS se existir
        if (dataFinal !== null) {
            data.dataAlvo = dataFinal;
        }

        return prisma.lembrete.create({ data });
    }

    // 🟡 Buscar lembrete por ID
    static async buscarPorId(id: string): Promise<Lembrete | null> {
        return prisma.lembrete.findUnique({
            where: { id },
        });
    }

    // 🟣 Listar lembretes de um usuário
    static async listarPorUsuario(usuarioId: string): Promise<Lembrete[]> {
        return prisma.lembrete.findMany({
            where: { usuarioId },
            orderBy: { dataAlvo: "asc" },
        });
    }

    // 🔵 Listar lembretes não enviados com data vencida
    static async listarPendentes(): Promise<Lembrete[]> {
        return prisma.lembrete.findMany({
            where: {
                enviado: false,
                dataAlvo: { lte: new Date() },
            },
            orderBy: { dataAlvo: "asc" },
        });
    }

    // 🟠 Marcar lembrete como enviado
    static async marcarComoEnviado(id: string): Promise<Lembrete> {
        return prisma.lembrete.update({
            where: { id },
            data: { enviado: true },
        });
    }

    // 🟤 Atualizar lembrete
    static async atualizar(id: string, dados: Partial<Lembrete>): Promise<Lembrete> {
        return prisma.lembrete.update({
            where: { id },
            data: dados,
        });
    }

    // 🔴 Deletar lembrete
    static async deletar(id: string): Promise<Lembrete> {
        return prisma.lembrete.delete({
            where: { id },
        });
    }
}
