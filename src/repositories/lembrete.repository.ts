import { PrismaClient, Lembrete } from "@prisma/client";

const prisma = new PrismaClient();

export class LembreteRepository {

    /** 🟢 Criar lembrete */
    static async criar(dados: {
        usuarioId: string;
        mensagem: string;
        valor?: number | null;
        data?: string | null;
        dataAlvo?: Date | null;
    }): Promise<Lembrete> {

        let dataFinal: Date | null = null;

        // Prioridade 1: dataAlvo explícita (Date)
        if (dados.dataAlvo instanceof Date) {
            dataFinal = dados.dataAlvo;
        }

        // Prioridade 2: data textual convertida via Date()
        else if (dados.data) {
            const convertida = new Date(dados.data);
            if (!isNaN(convertida.getTime())) {
                dataFinal = convertida;
            }
        }

        const data: any = {
            usuarioId: dados.usuarioId,
            mensagem: dados.mensagem,
            valor: dados.valor ?? null,
            enviado: false
        };

        if (dataFinal !== null) {
            data.dataAlvo = dataFinal;
        }

        return prisma.lembrete.create({ data });
    }

    /** 🟡 Buscar por ID */
    static async buscarPorId(id: string): Promise<Lembrete | null> {
        return prisma.lembrete.findUnique({
            where: { id }
        });
    }

    /** 🟣 Listar lembretes do usuário */
    static async listarPorUsuario(usuarioId: string): Promise<Lembrete[]> {
        return prisma.lembrete.findMany({
            where: { usuarioId },
            orderBy: { dataAlvo: "asc" }
        });
    }

    /** 🔵 Buscar lembretes futuros */
    static async listarFuturos(usuarioId: string) {
        return prisma.lembrete.findMany({
            where: {
                usuarioId,
                enviado: false,
                dataAlvo: { gte: new Date() }
            },
            orderBy: { dataAlvo: "asc" }
        });
    }

    /** 🔍 Buscar lembrete por texto + data (para exclusão inteligente) */
    /** 🔍 Buscar lembrete por texto + data (case-insensitive manual) */
    static async buscarPorTextoEData(usuarioId: string, texto: string, data: Date) {
        const todos = await prisma.lembrete.findMany({
            where: {
                usuarioId,
                dataAlvo: data
            }
        });

        const t = texto.toLowerCase();

        return todos.filter(l =>
            l.mensagem.toLowerCase().includes(t)
        );
    }

    /** 🔍 Buscar lembretes apenas pelo texto (case-insensitive manual) */
    static async buscarSemData(usuarioId: string, texto: string) {
        const todos = await prisma.lembrete.findMany({
            where: { usuarioId }
        });

        const t = texto.toLowerCase();

        return todos.filter(l =>
            l.mensagem.toLowerCase().includes(t)
        );
    }

    /** 🟠 Marcar como enviado */
    static async marcarComoEnviado(id: string): Promise<Lembrete> {
        return prisma.lembrete.update({
            where: { id },
            data: { enviado: true }
        });
    }

    /** 🟤 Atualizar lembrete */
    static async atualizar(id: string, dados: Partial<Lembrete>): Promise<Lembrete> {
        return prisma.lembrete.update({
            where: { id },
            data: dados
        });
    }

    /** 🔴 Deletar lembrete */
    static async deletar(id: string): Promise<Lembrete> {
        return prisma.lembrete.delete({
            where: { id }
        });
    }
}
