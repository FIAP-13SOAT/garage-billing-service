import { Quote } from '../../domain/quote/Quote.js';
import { QuoteItem } from '../../domain/quote/QuoteItem.js';
import { ItemType } from '../../domain/quote/ItemType.js';
import { Payment } from '../../domain/payment/Payment.js';
import type { QuoteGateway } from '../../adapters/outbound/database/QuoteGateway.js';
import type { PaymentGateway } from '../../adapters/outbound/database/PaymentGateway.js';
import type { MercadoPagoClient } from '../../adapters/outbound/mercadopago/MercadoPagoClient.js';
import type { UUID } from '../../shared/types/UUID.js';

export type GenerateQuoteCommand = {
  serviceOrderId: UUID;
  customerId: UUID;
  items: {
    description: string;
    unitPrice: number;
    quantity: number;
    type: ItemType;
  }[];
  payerEmail?: string;
  payerFirstName?: string;
  payerLastName?: string;
  payerDocument?: string;
};

export type GenerateQuoteResult = {
  quote: Quote;
  payment: Payment;
};

export class GenerateQuoteUseCase {
  constructor(
    private readonly quoteGateway: QuoteGateway,
    private readonly paymentGateway: PaymentGateway,
    private readonly mercadoPagoClient: MercadoPagoClient,
  ) {}

  async execute(command: GenerateQuoteCommand): Promise<GenerateQuoteResult> {
    const items = command.items.map((i) => new QuoteItem(i));
    const quote = new Quote({
      serviceOrderId: command.serviceOrderId,
      customerId: command.customerId,
      items,
    });
    const savedQuote = await this.quoteGateway.save(quote);

    const payer = command.payerEmail
      ? {
          email: command.payerEmail,
          firstName: command.payerFirstName,
          lastName: command.payerLastName,
          document: command.payerDocument,
        }
      : undefined;

    const mpItems = savedQuote.items.map((i) => ({
      id: i.id,
      title: i.description,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      categoryId: i.type === ItemType.SERVICE ? 'services' : 'vehicles',
    }));

    const mpResult = await this.mercadoPagoClient.createPixPayment(
      savedQuote.totalAmount,
      savedQuote.id,
      mpItems,
      payer,
    );

    const payment = new Payment({
      quoteId: savedQuote.id,
      serviceOrderId: savedQuote.serviceOrderId,
      amount: savedQuote.totalAmount,
      mercadoPagoId: mpResult.mercadoPagoId,
      paymentLink: mpResult.paymentLink,
      qrCode: mpResult.qrCode,
      qrCodeBase64: mpResult.qrCodeBase64,
    });
    const savedPayment = await this.paymentGateway.save(payment);

    return { quote: savedQuote, payment: savedPayment };
  }
}
