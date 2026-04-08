import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateQuoteUseCase } from '../GenerateQuoteUseCase.js';
import { Quote } from '../../../domain/quote/Quote.js';
import { QuoteItem } from '../../../domain/quote/QuoteItem.js';
import { ItemType } from '../../../domain/quote/ItemType.js';
import type { QuoteGateway } from '../../../adapters/outbound/database/QuoteGateway.js';
import { toUUID } from '../../../shared/types/UUID.js';

const mockGateway = {
  save: vi.fn(),
  findById: vi.fn(),
  findByServiceOrderId: vi.fn(),
} as unknown as QuoteGateway;

beforeEach(() => { vi.clearAllMocks(); });

const command = {
  serviceOrderId: toUUID('so-1'),
  customerId: toUUID('cust-1'),
  items: [
    { description: 'Oil change', unitPrice: 80, quantity: 1, type: ItemType.SERVICE },
    { description: 'Oil filter', unitPrice: 20, quantity: 2, type: ItemType.STOCK_ITEM },
  ],
};

describe('GenerateQuoteUseCase', () => {
  it('creates a Quote from command items and saves it', async () => {
    const savedQuote = new Quote({
      serviceOrderId: toUUID(command.serviceOrderId),
      customerId: toUUID(command.customerId),
      items: command.items.map((i) => new QuoteItem(i)),
    });
    vi.mocked(mockGateway.save).mockResolvedValue(savedQuote);

    const result = await new GenerateQuoteUseCase(mockGateway).execute(command);

    expect(mockGateway.save).toHaveBeenCalledOnce();
    const [passedQuote] = vi.mocked(mockGateway.save).mock.calls[0]!;
    expect(passedQuote).toBeInstanceOf(Quote);
    expect(passedQuote.serviceOrderId).toBe('so-1');
    expect(passedQuote.customerId).toBe('cust-1');
    expect(passedQuote.items).toHaveLength(2);
    expect(result).toBe(savedQuote);
  });

  it('calculates totalAmount correctly before saving', async () => {
    vi.mocked(mockGateway.save).mockImplementation(async (q) => q);

    await new GenerateQuoteUseCase(mockGateway).execute(command);

    const [passedQuote] = vi.mocked(mockGateway.save).mock.calls[0]!;
    expect(passedQuote.totalAmount).toBe(120); // 80*1 + 20*2
  });

  it('creates a Quote with zero totalAmount when items list is empty', async () => {
    vi.mocked(mockGateway.save).mockImplementation(async (q) => q);

    await new GenerateQuoteUseCase(mockGateway).execute({ ...command, items: [] });

    const [passedQuote] = vi.mocked(mockGateway.save).mock.calls[0]!;
    expect(passedQuote.totalAmount).toBe(0);
    expect(passedQuote.items).toHaveLength(0);
  });
});
