import type { Channel } from 'amqplib';
import {
  BillingCommand,
  type SagaMessage,
  type GerarOrcamentoPayload,
  type ProcessarPagamentoPayload,
  type CancelarPagamentoPayload,
} from '../../../application/messaging/messages.js';
import type { GenerateQuoteUseCase } from '../../../application/quote/GenerateQuoteUseCase.js';
import type { ProcessPaymentUseCase } from '../../../application/payment/ProcessPaymentUseCase.js';
import type { CancelPaymentUseCase } from '../../../application/payment/CancelPaymentUseCase.js';
import type { BillingReplyProducer } from '../../outbound/messaging/BillingReplyProducer.js';
import { ItemType } from '../../../domain/quote/ItemType.js';
import { toUUID } from '../../../shared/types/UUID.js';

const QUEUE = 'billing.commands';

export class BillingCommandConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly generateQuote: GenerateQuoteUseCase,
    private readonly processPayment: ProcessPaymentUseCase,
    private readonly cancelPayment: CancelPaymentUseCase,
    private readonly replyProducer: BillingReplyProducer,
  ) {}

  async start(): Promise<void> {
    await this.channel.assertQueue(QUEUE, { durable: true });
    await this.channel.consume(QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const { type, payload } = JSON.parse(msg.content.toString()) as SagaMessage;
        await this.handle(type, payload);
        this.channel.ack(msg);
      } catch (err) {
        console.error(`[BillingCommandConsumer] Failed to process message:`, err);
        this.channel.nack(msg, false, false);
      }
    });
    console.log(`[BillingCommandConsumer] Listening on ${QUEUE}`);
  }

  private async handle(type: string, payload: unknown): Promise<void> {
    switch (type) {
      case BillingCommand.GERAR_ORCAMENTO:
        await this.handleGerarOrcamento(payload as GerarOrcamentoPayload);
        break;
      case BillingCommand.PROCESSAR_PAGAMENTO:
        await this.handleProcessarPagamento(payload as ProcessarPagamentoPayload);
        break;
      case BillingCommand.CANCELAR_PAGAMENTO:
        await this.handleCancelarPagamento(payload as CancelarPagamentoPayload);
        break;
      default:
        console.warn(`[BillingCommandConsumer] Unknown message type: ${type}`);
    }
  }

  private async handleGerarOrcamento(payload: GerarOrcamentoPayload): Promise<void> {
    const quote = await this.generateQuote.execute({
      serviceOrderId: payload.serviceOrderId,
      customerId: payload.customerId,
      items: payload.items.map((i) => ({
        description: i.description,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        type: i.type === 'SERVICE' ? ItemType.SERVICE : ItemType.STOCK_ITEM,
      })),
    });

    await this.replyProducer.sendOrcamentoGerado({
      serviceOrderId: payload.serviceOrderId,
      quoteId: quote.id,
      totalAmount: quote.totalAmount,
    });
  }

  private async handleProcessarPagamento(payload: ProcessarPagamentoPayload): Promise<void> {
    const payment = await this.processPayment.execute({
      quoteId: payload.quoteId,
      serviceOrderId: payload.serviceOrderId,
    });

    if (payment.status === 'CONFIRMED') {
      await this.replyProducer.sendPagamentoConfirmado({
        serviceOrderId: payload.serviceOrderId,
        paymentId: payment.id,
      });
    } else {
      await this.replyProducer.sendPagamentoRecusado({
        serviceOrderId: payload.serviceOrderId,
        reason: 'Payment refused by provider',
      });
    }
  }

  private async handleCancelarPagamento(payload: CancelarPagamentoPayload): Promise<void> {
    await this.cancelPayment.execute({
      serviceOrderId: toUUID(payload.serviceOrderId),
    });

    await this.replyProducer.sendPagamentoCancelado({
      serviceOrderId: payload.serviceOrderId,
    });
  }
}
