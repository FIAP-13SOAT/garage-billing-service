import {
  BillingCommand,
  type GerarOrcamentoPayload,
  type CancelarPagamentoPayload,
} from '../../../application/messaging/messages.js';
import type { GenerateQuoteUseCase } from '../../../application/quote/GenerateQuoteUseCase.js';
import type { CancelPaymentUseCase } from '../../../application/payment/CancelPaymentUseCase.js';
import type { BillingReplyProducer } from '../../outbound/messaging/BillingReplyProducer.js';
import type { SQSBroker } from '../../outbound/messaging/SQSBroker.js';
import { ItemType } from '../../../domain/quote/ItemType.js';
import { toUUID } from '../../../shared/types/UUID.js';
import { Logger } from '../../../shared/logger/Logger.js';
import { env } from '../../../shared/config/env.js';

export class BillingCommandConsumer {
  constructor(
    private readonly broker: SQSBroker,
    private readonly generateQuote: GenerateQuoteUseCase,
    private readonly cancelPayment: CancelPaymentUseCase,
    private readonly replyProducer: BillingReplyProducer,
  ) {}

  async start(): Promise<void> {
    this.broker.subscribe(env.sqsQueues.billingCommands, async (type, payload) => {
      await this.handle(type, payload);
    });
    Logger.info('[BillingCommandConsumer] Listening', { queue: env.sqsQueues.billingCommands });
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
    });
  }

  private async handleCancelarPagamento(payload: CancelarPagamentoPayload): Promise<void> {
    await this.cancelPayment.execute({ serviceOrderId: toUUID(payload.serviceOrderId) });
    await this.replyProducer.sendPagamentoCancelado({ serviceOrderId: payload.serviceOrderId });
  }
}
