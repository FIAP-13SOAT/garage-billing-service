import type { QuoteGateway } from '../../adapters/outbound/database/QuoteGateway.js';
import { QuoteNotFoundException } from './exceptions/QuoteNotFoundException.js';
import type { Quote } from '../../domain/quote/Quote.js';
import type { UUID } from '../../shared/types/UUID.js';

export type ApproveQuoteCommand = { quoteId: UUID };

export class ApproveQuoteUseCase {
  constructor(private readonly gateway: QuoteGateway) {}

  async execute(command: ApproveQuoteCommand): Promise<Quote> {
    const quote = await this.gateway.findById(command.quoteId);
    if (!quote) throw new QuoteNotFoundException(command.quoteId);

    quote.approve();
    return this.gateway.save(quote);
  }
}
