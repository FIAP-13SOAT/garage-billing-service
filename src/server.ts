import 'dotenv/config';
import './instrument.js';
import app from './app.js';
import { connectDatabase, prisma } from './adapters/outbound/database/connection.js';
import { getRabbitMQChannel } from './adapters/outbound/messaging/rabbitmq.js';
import { env } from './shared/config/env.js';
import { QuoteGateway } from './adapters/outbound/database/QuoteGateway.js';
import { PaymentGateway } from './adapters/outbound/database/PaymentGateway.js';
import { MercadoPagoClient } from './adapters/outbound/mercadopago/MercadoPagoClient.js';
import { BillingReplyProducer } from './adapters/outbound/messaging/BillingReplyProducer.js';
import { BillingCommandConsumer } from './adapters/inbound/messaging/BillingCommandConsumer.js';
import { GenerateQuoteUseCase } from './application/quote/GenerateQuoteUseCase.js';
import { CancelPaymentUseCase } from './application/payment/CancelPaymentUseCase.js';

const start = async (): Promise<void> => {
  await connectDatabase();

  const channel = await getRabbitMQChannel();

  const quoteGateway = new QuoteGateway(prisma);
  const paymentGateway = new PaymentGateway(prisma);
  const mpClient = new MercadoPagoClient();
  const replyProducer = new BillingReplyProducer(channel);

  const consumer = new BillingCommandConsumer(
    channel,
    new GenerateQuoteUseCase(quoteGateway, paymentGateway, mpClient),
    new CancelPaymentUseCase(paymentGateway, mpClient),
    replyProducer,
  );

  await consumer.start();

  app.listen(env.port, () => {
    console.log(`garage-billing-service running on port ${env.port}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
