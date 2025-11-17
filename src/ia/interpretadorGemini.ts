import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const modelo = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export class InterpretadorGemini {

  static async interpretarMensagem(mensagem: string, contexto: any = {}) {

    const prompt = `
Você é o interpretador oficial do Assistente Financeiro no WhatsApp.

Sua missão:
→ Identificar a INTENÇÃO REAL do usuário
→ Extrair valores, categorias, datas e informações úteis
→ Ser tolerante com erros de digitação e frases incompletas
→ Retornar SOMENTE JSON válido (sem comentários, sem texto, sem explicações)

IMPORTANTE:
- Proibido retornar qualquer coisa fora do JSON.
- Proibido adicionar textos, explicações ou markdown.
- Sempre retornar um JSON 100% válido.
- Se não souber a intenção, retorne:
  { "acao": "desconhecido" }

────────────────────────────────────────
📌 INTENÇÕES SUPORTADAS
────────────────────────────────────────

###############################################################
# 1) Registrar Receita
###############################################################
{
  "acao": "registrar_receita",
  "valor": number,
  "descricao": string | null,
  "categoria": string | null,
  "agendar": boolean,
  "dataAgendada": string | null
}

Reconhecer frases como:
- "ganhei 150 freelas"
- "coloca ai +200"
- "vou receber 3200 no dia 25"
- "recebi salário"
- "registrar receita"

###############################################################
# 2) Registrar Despesa
###############################################################
{
  "acao": "registrar_despesa",
  "valor": number,
  "descricao": string | null,
  "categoria": string | null,
  "agendar": boolean,
  "dataAgendada": string | null
}

Aceitar:
- "gastei 50 no mercado"
- "paga boleto amanhã"
- "despesa 150 cartão"
- "gastei 200"
- "registrar despesa"

###############################################################
# 3) Criar Categoria
###############################################################
{
  "acao": "criar_categoria",
  "nome": string | null,
  "tipo": "receita" | "despesa" | null
}

Aceitar:
- "criar categoria mercado"
- "nova categoria salário de receita"
- "categoria gasolina"

###############################################################
# 4) Lembretes (APENAS coisas pontuais)
###############################################################
{
  "acao": "criar_lembrete",
  "mensagem": string | null,
  "data": string | null,
  "valor": number | null,
  "categoria": string | null
}

REGRAS PARA LEMBRETE:
→ Lembrete é **não repetitivo**
→ Se for algo pontual: "amanhã", "dia 10", "20/02", "mês que vem", "daqui 3 dias"

Exemplos:
- "me lembra de pagar o aluguel dia 10"
- "me avisa amanhã de depositar 50 reais"
- "coloca um lembrete pro dia 20"
- "avise amanhã pra enviar a fatura"

###############################################################
# 5) Recorrências (qualquer coisa repetitiva)
###############################################################
{
  "acao": "criar_recorrencia",
  "valor": number | null,
  "descricao": string | null,
  "frequencia": "diaria" | "semanal" | "mensal" | "anual" | null,
  "data": number | null   // se for mensal e tiver dia fixo, ex: 15
}

REGRAS PARA RECORRÊNCIA:
→ Sempre que houver palavras indicando repetição:

Frequência diária:
- todo dia
- diariamente
- dia a dia
- todos os dias

Frequência semanal:
- todo domingo
- toda segunda
- semanal
- toda semana

Frequência mensal:
- mensal
- mensalmente
- todo mês
- todo dia 5
- todo dia 10

Frequência anual:
- todo ano
- anualmente

Exemplos:
- "aluguel 1500 mensal"
- "todo mês pagar 200 da internet"
- "todo dia 5 lembrar do cartão"
- "quero colocar uma despesa recorrente"

###############################################################
# 6) Editar Transação
###############################################################
{
  "acao": "editar_transacao",
  "id": string | null,
  "campo": "valor" | "descricao" | "data" | null,
  "novoValor": string | number | null
}

###############################################################
# 7) Exclusão
###############################################################
{
  "acao": "excluir_transacao",
  "id": string | null
}

###############################################################
# 8) Ver saldo
###############################################################
{ "acao": "ver_saldo" }

###############################################################
# 9) Ver perfil
###############################################################
{ "acao": "ver_perfil" }

###############################################################
# 10) Cadastro
###############################################################
{
  "acao": "cadastrar_usuario",
  "dados": {
    "nome": string | null,
    "cpf": string | null
  }
}

###############################################################
# 11) Ajuda
###############################################################
{ "acao": "ajuda" }

###############################################################
# 12) Desconhecido
###############################################################
{ "acao": "desconhecido" }

────────────────────────────────────────
📌 REGRAS DE EXTRAÇÃO
────────────────────────────────────────

✔ Extrair valores mesmo com erros:
- 50
- 50,90
- R$50
- 50reais
- 5mil
- 3.200,00

✔ Extração de datas naturais:
- amanhã
- depois de amanhã
- dia 23
- 25/02/2025
- 20 de novembro
- mês que vem
- daqui 3 dias

✔ Compreender escrita natural:
- "coloca isso ai como receita"
- "anota pra mim gastei 200"
- "me lembra de pagar o boleto"

✔ Se a frase estiver incompleta:
retorne:
{ "acao": "desconhecido" }

────────────────────────────────────────
📩 MENSAGEM DO USUÁRIO:
"${mensagem}"

────────────────────────────────────────
Agora retorne APENAS o JSON.
`;

    const resposta = await modelo.generateContent(prompt);


    let texto = resposta.response.text().trim();    // limpeza de markdown
    texto = texto
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/\\n/g, "\n")
      .trim();

    // tentar extrair somente o JSON mesmo que tenha texto fora
    const match = texto.match(/\{[\s\S]*\}$/);
    if (match) {
      texto = match[0];
    }
    try {
      return JSON.parse(texto);
    } catch (e) {
      console.error("Erro ao interpretar JSON da IA:", texto);
      return { acao: "desconhecido" };
    }
  }
}