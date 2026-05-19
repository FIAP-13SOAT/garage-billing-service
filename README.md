# garage-billing-service

Microsserviço responsável pela geração de orçamentos e gestão de pagamentos da plataforma SOAT. Integra-se com o Mercado Pago para criação de cobranças PIX e recebe notificações via webhook para confirmar ou recusar pagamentos.

## Responsabilidades

- Geração de orçamentos (quotes) a partir de comandos da Saga
- Criação de cobranças no Mercado Pago (PIX)
- Recebimento de webhooks do Mercado Pago e publicação de respostas na Saga
- Cancelamento de pagamentos por compensação da Saga
- Consulta de status de pagamento por OS

## Papel na Saga

O billing-service é um **participante** da Saga orquestrada pelo OS Service. Ele consome comandos da fila `billing.commands` e publica respostas em `billing.replies`.

```
OS Service                     Billing Service               Mercado Pago
    |                                 |                            |
    |-- GERAR_ORCAMENTO ------------> |                            |
    |                                 |-- criar cobrança PIX ----> |
    |                                 |<-- paymentLink ----------- |
    |<-- ORCAMENTO_GERADO ----------- |                            |
    |                                 |<-- webhook (confirmado) -- |
    |<-- PAGAMENTO_CONFIRMADO ------- |                            |
    |                                 |                            |
    | (compensação)                   |                            |
    |-- CANCELAR_PAGAMENTO ---------> |                            |
    |<-- PAGAMENTO_CANCELADO -------- |                            |
```

## Stack

- **Runtime**: Node.js 24
- **Linguagem**: TypeScript (ESM)
- **Framework**: Express 5
- **ORM**: Prisma 7 + PostgreSQL 16
- **Mensageria**: amqplib (RabbitMQ)
- **Pagamentos**: Mercado Pago SDK v2
- **Testes**: Vitest + @vitest/coverage-v8
- **Observabilidade**: Datadog (dd-trace, logs JSON, métricas StatsD)

## Banco de dados

PostgreSQL com as seguintes entidades principais:

| Entidade | Descrição |
|---|---|
| `Quote` | Orçamento gerado para uma OS, contendo os itens e valor total |
| `QuoteItem` | Item de orçamento (serviço ou peça) com tipo, descrição, preço e quantidade |
| `Payment` | Pagamento associado ao orçamento, com link e status do Mercado Pago |

Status do pagamento: `PENDING`, `CONFIRMED`, `REFUSED`, `CANCELLED`

## Endpoints

### Orçamentos
| Método | Rota | Roles | Descrição |
|---|---|---|---|
| `GET` | `/quotes` | ADMIN, CLERK | Listar todos os orçamentos |

### Pagamentos
| Método | Rota | Roles | Descrição |
|---|---|---|---|
| `GET` | `/payments/:serviceOrderId/status` | Público | Consultar status do pagamento de uma OS |

### Webhook
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/webhook/mercadopago?topic=payment&serviceOrderId={id}` | Receber notificação do Mercado Pago |

### Health
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Health check |

## Mensagens RabbitMQ

### Consome — `billing.commands`
| Tipo | Descrição |
|---|---|
| `GERAR_ORCAMENTO` | Gera orçamento e cria cobrança PIX no Mercado Pago |
| `CANCELAR_PAGAMENTO` | Cancela o pagamento associado à OS (compensação) |

### Publica — `billing.replies`
| Tipo | Descrição |
|---|---|
| `ORCAMENTO_GERADO` | Orçamento criado com sucesso, contém `quoteId`, `paymentId` e `paymentLink` |
| `PAGAMENTO_CONFIRMADO` | Webhook confirmou pagamento aprovado |
| `PAGAMENTO_RECUSADO` | Webhook informou pagamento recusado |
| `PAGAMENTO_CANCELADO` | Pagamento cancelado por compensação |

## Integração Mercado Pago

O serviço suporta modo mock via variável de ambiente `MERCADO_PAGO_MOCK=true`, que aprova automaticamente o pagamento sem chamada real à API. Em produção, configure o `MERCADO_PAGO_ACCESS_TOKEN` com o token do ambiente sandbox ou live.

Para testes locais com webhook real, exponha o serviço via ngrok:

```bash
ngrok http 8081
# use a URL gerada em MERCADO_PAGO_WEBHOOK_URL
```

## Como rodar

### Pré-requisitos

- Node.js 24
- Docker e Docker Compose

### Subir dependências

```bash
# Crie o arquivo de variáveis de ambiente
cp .env.example .env
# Edite com suas credenciais do Mercado Pago

# Inicie o banco de dados e o RabbitMQ
docker compose up -d
```

### Iniciar o serviço

```bash
npm install
npm run dev
```

O serviço sobe na porta `8081` por padrão.

## Testes

```bash
# Executar todos os testes
npm test

# Executar com relatório de cobertura
npm run test:coverage
```

Cobertura mínima configurada: **90%** em linhas, funções e branches.

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `PORT` | Porta HTTP (padrão: `8081`) |
| `DATABASE_URL` | String de conexão PostgreSQL |
| `RABBITMQ_URL` | String de conexão RabbitMQ (amqp/amqps) |
| `MERCADO_PAGO_MOCK` | `true` para simular pagamentos sem API real |
| `MERCADO_PAGO_ACCESS_TOKEN` | Token do Mercado Pago (sandbox ou live) |
| `MERCADO_PAGO_WEBHOOK_URL` | URL pública para receber webhooks do MP |
| `DD_TRACE_ENABLED` | Habilita tracing do Datadog |
| `DD_SERVICE` | Nome do serviço no Datadog |

## CI/CD

Três pipelines independentes rodam a cada pull request para `main`:

| Pipeline | Descrição |
|---|---|
| `ci.yml` | Build, lint, testes e relatório de cobertura no PR |
| `lint.yml` | ESLint via reviewdog com anotações no diff |
| `quality.yml` | Detecção de duplicação (jscpd) e análise de code smells (sonarjs, security) |
