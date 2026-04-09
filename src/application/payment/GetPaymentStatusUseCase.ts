import type { PaymentGateway } from '../../adapters/outbound/database/PaymentGateway.js';
import { PaymentNotFoundException } from './exceptions/PaymentNotFoundException.js';
import type { Payment } from '../../domain/payment/Payment.js';
import type { UUID } from '../../shared/types/UUID.js';

export type GetPaymentStatusCommand = { serviceOrderId: UUID };

export class GetPaymentStatusUseCase {
  constructor(private readonly paymentGateway: PaymentGateway) {}

  async execute(command: GetPaymentStatusCommand): Promise<Payment> {
    const payment = await this.paymentGateway.findByServiceOrderId(command.serviceOrderId);
    if (!payment) throw new PaymentNotFoundException(command.serviceOrderId);
    return payment;
  }
}
