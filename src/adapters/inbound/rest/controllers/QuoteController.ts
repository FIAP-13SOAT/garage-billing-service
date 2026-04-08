import type { QuoteGateway } from '../../../outbound/database/QuoteGateway.js';
import { ListQuotesUseCase } from '../../../../application/quote/ListQuotesUseCase.js';
import { ApproveQuoteUseCase } from '../../../../application/quote/ApproveQuoteUseCase.js';
import { RejectQuoteUseCase } from '../../../../application/quote/RejectQuoteUseCase.js';
import type { Quote } from '../../../../domain/quote/Quote.js';
import type { UUID } from '../../../../shared/types/UUID.js';

export class QuoteController {
  constructor(private readonly gateway: QuoteGateway) {}

  async list(): Promise<Quote[]> {
    return new ListQuotesUseCase(this.gateway).execute();
  }

  async approve(id: UUID): Promise<Quote> {
    return new ApproveQuoteUseCase(this.gateway).execute({ quoteId: id });
  }

  async reject(id: UUID): Promise<Quote> {
    return new RejectQuoteUseCase(this.gateway).execute({ quoteId: id });
  }
}
