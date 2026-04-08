import { Quote } from '../../domain/quote/Quote.js';
import { QuoteItem } from '../../domain/quote/QuoteItem.js';
import { ItemType } from '../../domain/quote/ItemType.js';
import type { QuoteGateway } from '../../adapters/outbound/database/QuoteGateway.js';
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
};

export class GenerateQuoteUseCase {
  constructor(private readonly gateway: QuoteGateway) {}

  async execute(command: GenerateQuoteCommand): Promise<Quote> {
    const items = command.items.map((i) => new QuoteItem(i));
    const quote = new Quote({
      serviceOrderId: command.serviceOrderId,
      customerId: command.customerId,
      items,
    });
    return this.gateway.save(quote);
  }
}
