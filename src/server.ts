import 'dotenv/config';
import './instrument.js';
import app from './app.js';
import { connectDatabase, prisma } from './adapters/outbound/database/connection.js';
import { SQSBroker, sqsClient } from './adapters/outbound/messaging/SQSBroker.js';
import { env } from './shared/config/env.js';
import { Logger } from './shared/logger/Logger.js';
import { QuoteGateway } from './adapters/outbound/database/QuoteGateway.js';
import { PaymentGateway } from './adapters/outbound/database/PaymentGateway.js';
import { MercadoPagoClient } from './adapters/outbound/mercadopago/MercadoPagoClient.js';
import { BillingReplyProducer } from './adapters/outbound/messaging/BillingReplyProducer.js';
import { BillingCommandConsumer } from './adapters/inbound/messaging/BillingCommandConsumer.js';
import { GenerateQuoteUseCase } from './application/quote/GenerateQuoteUseCase.js';
import { CancelPaymentUseCase } from './application/payment/CancelPaymentUseCase.js';

const start = async (): Promise<void> => {
  await connectDatabase();

  const broker = new SQSBroker(sqsClient);
  const replyProducer = new BillingReplyProducer(broker);

  await new BillingCommandConsumer(
    broker,
    new GenerateQuoteUseCase(new QuoteGateway(prisma), new PaymentGateway(prisma), new MercadoPagoClient()),
    new CancelPaymentUseCase(new PaymentGateway(prisma)),
    replyProducer,
  ).start();

  const server = app.listen(env.port, () => {
    Logger.info(`garage-billing-service running on port ${env.port}`);
  });

  const shutdown = (): void => {
    broker.stop();
    server.close();
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
};

start().catch((err) => {
  Logger.error('Failed to start server', { err });
  process.exit(1);
});
