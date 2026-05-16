import type { PaymentGateway } from '../../adapters/outbound/database/PaymentGateway.js';
import type { BillingReplyProducer } from '../../adapters/outbound/messaging/BillingReplyProducer.js';
import { PaymentStatus } from '../../domain/payment/PaymentStatus.js';
import { toUUID } from '../../shared/types/UUID.js';

export type HandleWebhookCommand = {
  serviceOrderId: string;
};

export class HandleWebhookUseCase {
  constructor(
    private readonly paymentGateway: PaymentGateway,
    private readonly replyProducer: BillingReplyProducer,
  ) {}

  async execute(command: HandleWebhookCommand): Promise<void> {
    const payment = await this.paymentGateway.findByServiceOrderId(toUUID(command.serviceOrderId));
    if (!payment) return;
    if (payment.status !== PaymentStatus.PENDING) return;

    payment.confirm();
    await this.paymentGateway.save(payment);
    await this.replyProducer.sendPagamentoConfirmado({
      serviceOrderId: payment.serviceOrderId,
      paymentId: payment.id,
    });
  }
}
