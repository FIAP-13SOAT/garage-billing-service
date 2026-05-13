import type { QuoteGateway } from '../../../outbound/database/QuoteGateway.js';
import { ListQuotesUseCase } from '../../../../application/quote/ListQuotesUseCase.js';
import type { Quote } from '../../../../domain/quote/Quote.js';

export class QuoteController {
  constructor(private readonly gateway: QuoteGateway) {}

  async list(): Promise<Quote[]> {
    return new ListQuotesUseCase(this.gateway).execute();
  }
}
