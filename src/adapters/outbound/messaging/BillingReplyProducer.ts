import type { Channel } from 'amqplib';
import {
  BillingReply,
  type SagaMessage,
  type OrcamentoGeradoPayload,
  type PagamentoConfirmadoPayload,
  type PagamentoRecusadoPayload,
  type PagamentoCanceladoPayload,
} from '../../../application/messaging/messages.js';
import { setupQueue } from './setupQueue.js';

const QUEUE = 'billing.replies';

export class BillingReplyProducer {
  constructor(private readonly channel: Channel) {}

  async sendOrcamentoGerado(payload: OrcamentoGeradoPayload): Promise<void> {
    await this.send(BillingReply.ORCAMENTO_GERADO, payload);
  }

  async sendPagamentoConfirmado(payload: PagamentoConfirmadoPayload): Promise<void> {
    await this.send(BillingReply.PAGAMENTO_CONFIRMADO, payload);
  }

  async sendPagamentoRecusado(payload: PagamentoRecusadoPayload): Promise<void> {
    await this.send(BillingReply.PAGAMENTO_RECUSADO, payload);
  }

  async sendPagamentoCancelado(payload: PagamentoCanceladoPayload): Promise<void> {
    await this.send(BillingReply.PAGAMENTO_CANCELADO, payload);
  }

  private async send<T>(type: string, payload: T): Promise<void> {
    await setupQueue(this.channel, QUEUE);
    const message: SagaMessage<T> = { type, payload };
    this.channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(message)), { persistent: true });
  }
}
