export const env = {
  port: parseInt(process.env['PORT'] ?? '8081', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  databaseUrl: process.env['DATABASE_URL'] ?? '',
  rabbitmqUrl: process.env['RABBITMQ_URL'] ?? '',
  mercadoPagoMock: process.env['MERCADO_PAGO_MOCK'] === 'true',
  mercadoPagoToken: process.env['MERCADO_PAGO_ACCESS_TOKEN'] ?? '',
  mercadoPagoWebhookUrl: process.env['MERCADO_PAGO_WEBHOOK_URL'] ?? '',
  datadog: {
    apiKey: process.env['DD_API_KEY'] ?? '',
    appKey: process.env['DD_APP_KEY'] ?? '',
    service: process.env['DD_SERVICE'] ?? 'garage-billing-service',
    env: process.env['DD_ENV'] ?? 'development',
    version: process.env['DD_VERSION'] ?? '1.0.0',
    agentHost: process.env['DD_AGENT_HOST'] ?? 'localhost',
    traceEnabled: process.env['DD_TRACE_ENABLED'] !== 'false',
  },
};
