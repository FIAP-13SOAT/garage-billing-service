import { Payment } from '../../domain/payment/Payment.js';
import type { PaymentGateway } from '../../adapters/outbound/database/PaymentGateway.js';
import type { QuoteGateway } from '../../adapters/outbound/database/QuoteGateway.js';
import type { MercadoPagoClient } from '../../adapters/outbound/mercadopago/MercadoPagoClient.js';
import { QuoteNotFoundException } from '../quote/exceptions/QuoteNotFoundException.js';
import { AppError } from '../../shared/errors/AppError.js';
import type { UUID } from '../../shared/types/UUID.js';

export type ProcessPaymentCommand = {
  quoteId: UUID;
  serviceOrderId: UUID;
};

export class ProcessPaymentUseCase {
  constructor(
    private readonly paymentGateway: PaymentGateway,
    private readonly quoteGateway: QuoteGateway,
    private readonly mercadoPagoClient: MercadoPagoClient,
  ) {}

  async execute(command: ProcessPaymentCommand): Promise<Payment> {
    const quote = await this.quoteGateway.findById(command.quoteId);
    if (!quote) throw new QuoteNotFoundException(command.quoteId);
    if (quote.status !== 'APPROVED') {
      throw new AppError(`Quote is not approved: ${quote.status}`, 422);
    }

    const payment = new Payment({
      quoteId: command.quoteId,
      serviceOrderId: command.serviceOrderId,
      amount: quote.totalAmount,
    });

    const result = await this.mercadoPagoClient.processPayment(payment.amount);

    if (result.approved) {
      payment.confirm(result.mercadoPagoId, result.qrCode, result.qrCodeBase64);
    } else {
      payment.refuse();
    }

    return this.paymentGateway.save(payment);
  }
}
