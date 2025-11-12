# GG‑Assistente Financeiro (MVP — WhatsApp Bot)

> 🇧🇷 Versão organizada, em português, com navegação por tópicos e foco em segurança e escalabilidade.

---

## 📌 Sumário (clique para navegar)

1. [🎯 Objetivo](#-objetivo)  
2. [⚡ Funcionalidades do MVP](#-funcionalidades-do-mvp)  
3. [🛠 Tecnologias Utilizadas](#-tecnologias-utilizadas)  
4. [🏗 Arquitetura do Sistema](#-arquitetura-do-sistema)  
5. [🔐 Segurança e Privacidade](#-segurança-e-privacidade)  
6. [✅ Checklist de Desenvolvimento](#-checklist-de-desenvolvimento)  
7. [🧩 Modelagem do Banco de Dados (MySQL)](#️-modelagem-do-banco-de-dados-mysql)  
8. [💬 Exemplos de Conversas com o Bot](#-exemplos-de-conversas-com-o-bot)  
9. [💡 Dicas de Implementação](#-dicas-de-implementação)  
10. [📊 Indicadores de Sucesso do MVP](#-indicadores-de-sucesso-do-mvp)  
11. [🚀 Upgrades Futuros (v2)](#-upgrades-futuros-v2)  
12. [🔑 Variáveis de Ambiente](#-variáveis-de-ambiente)  
13. [📁 Estrutura de Pastas](#-estrutura-de-pastas)  
14. [🧠 Função de cada pasta](#-função-de-cada-pasta)  
15. [🏁 Resumo do MVP](#-resumo-do-mvp)

---

## 🎯 Objetivo

Criar um **assistente financeiro inteligente via WhatsApp** para registrar receitas e despesas, gerar insights financeiros e validar adesão de usuários através de um MVP enxuto, rápido e escalável.

---

## ⚡ Funcionalidades do MVP

| Recurso | Status |
|--------|:------:|
| Cadastro automático do usuário pelo WhatsApp | ✅ |
| Registrar receitas e despesas por mensagem | ✅ |
| Classificação de transações | ⚠️ (manual ou por keywords no v1) |
| Consultar saldo | ✅ |
| Relatório mensal | ✅ |
| Armazenamento em banco de dados (MySQL) | ✅ |
| Respostas automáticas | ✅ |

---

## 🛠 Tecnologias Utilizadas

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript |
| Runtime | Node.js |
| API Framework | **Fastify** |
| Banco de Dados | **MySQL** |
| ORM (Opcional) | Prisma ou Drizzle |
| API do WhatsApp | Meta Cloud API |
| Hospedagem | Railway, Render ou VPS |
| Validação | Zod |
| Logs | Pino |
| IA futura | OpenAI |

---

## 🏗 Arquitetura do Sistema

```
WhatsApp → API Meta → Webhook Fastify → Processamento → MySQL → Resposta ao usuário
```

---

## 🔐 Segurança, Privacidade e Isolamento de Usuários

Como o projeto lidará com dados financeiros e mensagens privadas no WhatsApp, a segurança é prioridade máxima. O sistema deve garantir que NENHUM usuário consiga acessar dados de outro, mesmo em caso de falhas, ataques ou má implementação.

✅ Requisitos obrigatórios de segurança
- Risco	Medida obrigatória
- Um usuário ver dados de outro	Todas as consultas ao banco devem filtrar pelo user_id sempre
- Vazamento via API	Nenhum endpoint pode retornar dados sem autenticação/verificação
- Invasão por requisições manipuladas	Validar TODA entrada de dados (Zod, DTOs, etc)
- Injeção SQL	Usar ORM ou queries parametrizadas (Prisma/Drizzle/MySQL2)
- Roubo de sessão	Não armazenar dados sensíveis sem criptografia
- Vazamento por logs	Não logar mensagens, saldos ou transações brutas
- Vazamento de banco	Senhas/API Keys em .env e nunca no código
- Simulação de identidade	Confirmar número do usuário em TODA interação do WhatsApp
- Ataques de repetição	Implementar limite de requests (rate limit)
- APIs públicas	Bloquear CORS, permitir apenas origens confiáveis


### Regras essenciais

| Risco | Proteção obrigatória |
|---|---|
| Um usuário ver dados de outro | Todas as queries devem usar `WHERE user_id = ?` |
| SQL Injection | Usar prepared queries ou ORM |
| Vazamento em logs | Não registrar valores financeiros |
| Credenciais expostas | Guardar em `.env` |
| Validação de identidade | Conferir número do remetente do WhatsApp |
| Requisições maliciosas | Usar rate limit, validar schema, bloquear CORS |

### Exemplo incorreto ❌

```sql
SELECT * FROM transactions;
```

### Exemplo correto ✅

```sql
SELECT * FROM transactions WHERE user_id = ?;
```

---

## ✅ Checklist de Desenvolvimento

### 1 — Setup
- [x] Criar repositório Git
- [x] Configurar TypeScript, ESLint e Prettier
- [x] Configurar Fastify + Zod + Logger
- [x] Estruturar pastas do projeto

### 2 — Banco (MySQL)
- [x] Criar banco e tabelas
- [x] Configurar conexão e migrations
- [x] Garantir index e isolamento por `user_id`

### 3 — WhatsApp
- [ ] Criar app no Meta
- [ ] Configurar webhook e verificar token
- [x] Receber e enviar mensagens

### 4 — Bot
- [ ] Identificar intenção (gasto, receita, saldo, relatório)
- [ ] Extrair valores, validar e salvar
- [ ] Responder corretamente

### 5 — Deploy
- [ ] Publicar API
- [ ] Configurar variáveis de ambiente
- [ ] Registrar webhook na Meta

---

🧩 Modelagem do Banco de Dados (MySQL)

### usuarios
```sql
id VARCHAR(36) PRIMARY KEY,
telefone VARCHAR(255) UNIQUE NOT NULL,
nome VARCHAR(255) NULL,
cpf_cnpj VARCHAR(20) NULL,
criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
```

### categorias
```sql
id VARCHAR(36) PRIMARY KEY,
usuario_id VARCHAR(36) NOT NULL,
nome VARCHAR(255) NOT NULL,
tipo ENUM('receita', 'despesa'),
icone VARCHAR(255) NULL,
cor VARCHAR(50) NULL,
criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
```

### transacoes
```sql
id VARCHAR(36) PRIMARY KEY,
usuario_id VARCHAR(36) NOT NULL,
categoria_id VARCHAR(36) NULL,
tipo ENUM('receita', 'despesa'),
valor DECIMAL(10,2) NOT NULL,
descricao VARCHAR(255) NULL,
data DATETIME NOT NULL,
recorrente BOOLEAN DEFAULT false,
criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
FOREIGN KEY (categoria_id) REFERENCES categorias(id)
```

### recorrencias
```sql
id VARCHAR(36) PRIMARY KEY,
usuario_id VARCHAR(36) NOT NULL,
transacao_id VARCHAR(36) UNIQUE NOT NULL,
frequencia ENUM('diaria', 'semanal', 'mensal', 'anual'),
intervalo INT DEFAULT 1,
proxima_cobranca DATETIME NOT NULL,

FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
FOREIGN KEY (transacao_id) REFERENCES transacoes(id)
```

### relatorios
```sql
id VARCHAR(36) PRIMARY KEY,
usuario_id VARCHAR(36) NOT NULL,
mes VARCHAR(7) NOT NULL,
total_receitas DECIMAL(10,2) NOT NULL,
total_despesas DECIMAL(10,2) NOT NULL,
saldo DECIMAL(10,2) NOT NULL,
criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
```

### bot_logs
```sql
id VARCHAR(36) PRIMARY KEY,
usuario_id VARCHAR(36) NOT NULL,
intencao VARCHAR(255) NOT NULL,
mensagem VARCHAR(255) NULL,
criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
```
---

## 💬 Exemplos de Conversas com o Bot

| Usuário | Bot |
|---|---|
| “Gastei 30 no Uber” | ✅ Gasto de R$30 registrado |
| “Salário 2000” | ✅ Receita de R$2000 salva |
| “Saldo” | 💰 Seu saldo atual é R$ XXXX |

---

## 💡 Dicas de Implementação

Regex simples para capturar valores:

```ts
const value = message.match(/\d+[.,]?\d*/)?.[0]
```

Webhook base com Fastify:

```ts
fastify.post('/webhook', async (req, reply) => {
  const message = req.body.entry[0].changes[0].value.messages[0].text.body
  return reply.send({ status: 'received' })
})
```

---

## 📊 Indicadores de Sucesso do MVP

| Métrica | Meta |
|---|---|
| Usuários ativos | 30–50 |
| Retenção 7 dias | 40%+ |
| Interpretação correta | 80%+ |

---

## 🚀 Upgrades Futuros (v2)

- Classificação via IA
- Dashboard web
- Gráficos e alertas
- Orçamentos e metas
- Suporte a grupos

---

## 🔑 Variáveis de Ambiente

```
DATABASE_URL=mysql://user:pass@host:3306/gg_finance
WHATSAPP_TOKEN=SEU_TOKEN_META
WHATSAPP_PHONE_ID=SEU_PHONE_ID
```

---

## 📁 Estrutura de Pastas

```
src/
├── config
├── controllers
├── infra
├── middlewares
├── repositories
├── routes
├── services
├── types
├── utils
├── validators
└── webhooks
```

---

## 🧠 Função de cada pasta

| Pasta | Responsabilidade |
|---|---|
| config | Variáveis, conexões, configurações |
| controllers | Entrada e saída das requisições |
| infra | Banco e serviços externos |
| middlewares | Segurança, logs, interceptação |
| repositories | Queries do banco |
| routes | Definição de endpoints |
| services | Regras de negócio |
| types | Tipagem global |
| utils | Funções auxiliares |
| validators | Validação com Zod |
| webhooks | Entradas externas (WhatsApp) |

---

## 🏁 Resumo do MVP

✅ Valida adesão  
✅ Automatiza registro financeiro  
✅ É escalável e seguro  
✅ Prepara caminho para IA  

---

