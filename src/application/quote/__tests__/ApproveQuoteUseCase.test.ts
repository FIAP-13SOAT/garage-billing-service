import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApproveQuoteUseCase } from '../ApproveQuoteUseCase.js';
import { Quote } from '../../../domain/quote/Quote.js';
import { QuoteStatus } from '../../../domain/quote/QuoteStatus.js';
import { QuoteNotFoundException } from '../exceptions/QuoteNotFoundException.js';
import type { QuoteGateway } from '../../../adapters/outbound/database/QuoteGateway.js';
import { toUUID } from '../../../shared/types/UUID.js';

const mockGateway = {
  save: vi.fn(),
  findById: vi.fn(),
  findByServiceOrderId: vi.fn(),
} as unknown as QuoteGateway;

beforeEach(() => { vi.clearAllMocks(); });

const makeQuote = (status = QuoteStatus.PENDING) =>
  new Quote({ serviceOrderId: toUUID('so-1'), customerId: toUUID('cust-1'), items: [], status });

describe('ApproveQuoteUseCase', () => {
  it('approves a PENDING quote and saves it', async () => {
    const quote = makeQuote();
    vi.mocked(mockGateway.findById).mockResolvedValue(quote);
    vi.mocked(mockGateway.save).mockImplementation(async (q) => q);

    const result = await new ApproveQuoteUseCase(mockGateway).execute({ quoteId: toUUID('q-1') });

    expect(result.status).toBe(QuoteStatus.APPROVED);
    expect(mockGateway.save).toHaveBeenCalledOnce();
  });

  it('throws QuoteNotFoundException when quote does not exist', async () => {
    vi.mocked(mockGateway.findById).mockResolvedValue(null);

    await expect(
      new ApproveQuoteUseCase(mockGateway).execute({ quoteId: toUUID('q-missing') }),
    ).rejects.toThrow(QuoteNotFoundException);
    expect(mockGateway.save).not.toHaveBeenCalled();
  });

  it('propagates QuoteAlreadyProcessedException from domain', async () => {
    const quote = makeQuote(QuoteStatus.APPROVED);
    vi.mocked(mockGateway.findById).mockResolvedValue(quote);

    await expect(
      new ApproveQuoteUseCase(mockGateway).execute({ quoteId: toUUID('q-1') }),
    ).rejects.toThrow(expect.objectContaining({ statusCode: 409 }));
    expect(mockGateway.save).not.toHaveBeenCalled();
  });
});
