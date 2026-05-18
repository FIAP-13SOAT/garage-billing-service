import {
  BillingReply,
  type OrcamentoGeradoPayload,
  type PagamentoConfirmadoPayload,
  type PagamentoRecusadoPayload,
  type PagamentoCanceladoPayload,
} from '../../../application/messaging/messages.js';
import type { SQSBroker } from './SQSBroker.js';
import { env } from '../../../shared/config/env.js';

export class BillingReplyProducer {
  constructor(private readonly broker: SQSBroker) {}

  async sendOrcamentoGerado(payload: OrcamentoGeradoPayload): Promise<void> {
    await this.broker.publish(env.sqsQueues.billingReplies, BillingReply.ORCAMENTO_GERADO, payload);
  }

  async sendPagamentoConfirmado(payload: PagamentoConfirmadoPayload): Promise<void> {
    await this.broker.publish(env.sqsQueues.billingReplies, BillingReply.PAGAMENTO_CONFIRMADO, payload);
  }

  async sendPagamentoRecusado(payload: PagamentoRecusadoPayload): Promise<void> {
    await this.broker.publish(env.sqsQueues.billingReplies, BillingReply.PAGAMENTO_RECUSADO, payload);
  }

  async sendPagamentoCancelado(payload: PagamentoCanceladoPayload): Promise<void> {
    await this.broker.publish(env.sqsQueues.billingReplies, BillingReply.PAGAMENTO_CANCELADO, payload);
  }
}
