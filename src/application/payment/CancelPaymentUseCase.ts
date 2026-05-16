import type { PaymentGateway } from '../../adapters/outbound/database/PaymentGateway.js';
import { PaymentNotFoundException } from './exceptions/PaymentNotFoundException.js';
import type { Payment } from '../../domain/payment/Payment.js';
import type { UUID } from '../../shared/types/UUID.js';

export type CancelPaymentCommand = { serviceOrderId: UUID };

export class CancelPaymentUseCase {
  constructor(private readonly paymentGateway: PaymentGateway) {}

  async execute(command: CancelPaymentCommand): Promise<Payment> {
    const payment = await this.paymentGateway.findByServiceOrderId(command.serviceOrderId);
    if (!payment) throw new PaymentNotFoundException(command.serviceOrderId);

    payment.cancel();
    return this.paymentGateway.save(payment);
  }
}
