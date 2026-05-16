import type { Payment } from '../../../../domain/payment/Payment.js';

type PaymentResponse = {
  id: string;
  serviceOrderId: string;
  quoteId: string;
  amount: number;
  status: string;
  mercadoPagoId: string | null;
  paymentLink: string | null;
  createdAt: string;
};

export class PaymentPresenter {
  static toResponse(payment: Payment): PaymentResponse {
    return {
      id: payment.id,
      serviceOrderId: payment.serviceOrderId,
      quoteId: payment.quoteId,
      amount: payment.amount,
      status: payment.status,
      mercadoPagoId: payment.mercadoPagoId,
      paymentLink: payment.paymentLink,
      createdAt: payment.createdAt.toISOString(),
    };
  }
}
