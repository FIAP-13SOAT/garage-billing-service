import type { Channel } from 'amqplib';
import { setupQueue } from '../../outbound/messaging/setupQueue.js';
import {
  BillingCommand,
  type SagaMessage,
  type GerarOrcamentoPayload,
  type CancelarPagamentoPayload,
} from '../../../application/messaging/messages.js';
import type { GenerateQuoteUseCase } from '../../../application/quote/GenerateQuoteUseCase.js';
import type { CancelPaymentUseCase } from '../../../application/payment/CancelPaymentUseCase.js';
import type { BillingReplyProducer } from '../../outbound/messaging/BillingReplyProducer.js';
import { ItemType } from '../../../domain/quote/ItemType.js';
import { toUUID } from '../../../shared/types/UUID.js';
import { Logger } from '../../../shared/logger/Logger.js';

const QUEUE = 'billing.commands';

export class BillingCommandConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly generateQuote: GenerateQuoteUseCase,
    private readonly cancelPayment: CancelPaymentUseCase,
    private readonly replyProducer: BillingReplyProducer,
  ) {}

  async start(): Promise<void> {
    await setupQueue(this.channel, QUEUE);
    await this.channel.consume(QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const { type, payload } = JSON.parse(msg.content.toString()) as SagaMessage;
        await this.handle(type, payload);
        this.channel.ack(msg);
      } catch (err) {
        Logger.error('[BillingCommandConsumer] Failed to process message', { err });
        this.channel.nack(msg, false, false);
      }
    });
    Logger.info('[BillingCommandConsumer] Listening', { queue: QUEUE });
  }

  private async handle(type: string, payload: unknown): Promise<void> {
    switch (type) {
      case BillingCommand.GERAR_ORCAMENTO:
        await this.handleGerarOrcamento(payload as GerarOrcamentoPayload);
        break;
      case BillingCommand.CANCELAR_PAGAMENTO:
        await this.handleCancelarPagamento(payload as CancelarPagamentoPayload);
        break;
      default:
        Logger.warn('[BillingCommandConsumer] Unknown message type', { type });
    }
  }

  private async handleGerarOrcamento(payload: GerarOrcamentoPayload): Promise<void> {
    const { quote, payment } = await this.generateQuote.execute({
      serviceOrderId: payload.serviceOrderId,
      customerId: payload.customerId,
      items: payload.items.map((i) => ({
        description: i.description,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        type: i.type === 'SERVICE' ? ItemType.SERVICE : ItemType.STOCK_ITEM,
      })),
      payerEmail: payload.payerEmail,
      payerFirstName: payload.payerFirstName,
      payerLastName: payload.payerLastName,
      payerDocument: payload.payerDocument,
    });

    await this.replyProducer.sendOrcamentoGerado({
      serviceOrderId: payload.serviceOrderId,
      quoteId: quote.id,
      paymentId: payment.id,
      totalAmount: quote.totalAmount,
      paymentLink: payment.paymentLink,
      qrCode: payment.qrCode,
    });
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
