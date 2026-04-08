import type { QuoteGateway } from '../../adapters/outbound/database/QuoteGateway.js';
import { QuoteNotFoundException } from './exceptions/QuoteNotFoundException.js';
import type { Quote } from '../../domain/quote/Quote.js';
import type { UUID } from '../../shared/types/UUID.js';

export type RejectQuoteCommand = { quoteId: UUID };

export class RejectQuoteUseCase {
  constructor(private readonly gateway: QuoteGateway) {}

  async execute(command: RejectQuoteCommand): Promise<Quote> {
    const quote = await this.gateway.findById(command.quoteId);
    if (!quote) throw new QuoteNotFoundException(command.quoteId);

    quote.reject();
    return this.gateway.save(quote);
  }
}
