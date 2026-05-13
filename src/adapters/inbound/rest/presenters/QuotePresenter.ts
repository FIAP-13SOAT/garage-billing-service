import type { Quote } from '../../../../domain/quote/Quote.js';
import type { QuoteItem } from '../../../../domain/quote/QuoteItem.js';

type QuoteItemResponse = {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  type: string;
};

type QuoteResponse = {
  id: string;
  serviceOrderId: string;
  customerId: string;
  items: QuoteItemResponse[];
  totalAmount: number;
  createdAt: string;
};

export class QuotePresenter {
  static toResponse(quote: Quote): QuoteResponse {
    return {
      id: quote.id,
      serviceOrderId: quote.serviceOrderId,
      customerId: quote.customerId,
      items: quote.items.map(QuotePresenter.toItemResponse),
      totalAmount: quote.totalAmount,
      createdAt: quote.createdAt.toISOString(),
    };
  }

  static toListResponse(quotes: Quote[]): QuoteResponse[] {
    return quotes.map(QuotePresenter.toResponse);
  }

  private static toItemResponse(item: QuoteItem): QuoteItemResponse {
    return {
      id: item.id,
      description: item.description,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
      type: item.type,
    };
  }
}
