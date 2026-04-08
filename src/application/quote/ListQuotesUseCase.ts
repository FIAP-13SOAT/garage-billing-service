import type { QuoteGateway } from '../../adapters/outbound/database/QuoteGateway.js';
import type { Quote } from '../../domain/quote/Quote.js';

export class ListQuotesUseCase {
  constructor(private readonly gateway: QuoteGateway) {}

  async execute(): Promise<Quote[]> {
    return this.gateway.findAll();
  }
}
