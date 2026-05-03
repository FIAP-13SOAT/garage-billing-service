import type { PaymentGateway } from '../../adapters/outbound/database/PaymentGateway.js';
import type { MercadoPagoClient } from '../../adapters/outbound/mercadopago/MercadoPagoClient.js';
import type { BillingReplyProducer } from '../../adapters/outbound/messaging/BillingReplyProducer.js';
import { PaymentStatus } from '../../domain/payment/PaymentStatus.js';

export type HandleWebhookCommand = {
  mercadoPagoId: string;
};

export class HandleWebhookUseCase {
  constructor(
    private readonly paymentGateway: PaymentGateway,
    private readonly mercadoPagoClient: MercadoPagoClient,
    private readonly replyProducer: BillingReplyProducer,
  ) {}

  async execute(command: HandleWebhookCommand): Promise<void> {
    const payment = await this.paymentGateway.findByMercadoPagoId(command.mercadoPagoId);
    if (!payment) return; // not ours — ignore

    if (payment.status !== PaymentStatus.PENDING) return; // already processed — idempotent

    const result = await this.mercadoPagoClient.getPayment(command.mercadoPagoId);

    if (result.status === 'approved') {
      payment.confirm(command.mercadoPagoId);
      await this.paymentGateway.save(payment);
      await this.replyProducer.sendPagamentoConfirmado({
        serviceOrderId: payment.serviceOrderId,
        paymentId: payment.id,
      });
    } else if (result.status === 'rejected' || result.status === 'cancelled') {
      payment.refuse();
      await this.paymentGateway.save(payment);
      await this.replyProducer.sendPagamentoRecusado({
        serviceOrderId: payment.serviceOrderId,
        reason: `Payment ${result.status} by provider`,
      });
    }
    // pending → no-op, MP will send another webhook when status changes
  }
}
