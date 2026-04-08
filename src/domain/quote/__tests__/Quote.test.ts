import { describe, it, expect } from 'vitest';
import { Quote } from '../Quote.js';
import { QuoteItem } from '../QuoteItem.js';
import { QuoteStatus } from '../QuoteStatus.js';
import { ItemType } from '../ItemType.js';
import { QuoteAlreadyProcessedException } from '../exceptions/QuoteAlreadyProcessedException.js';
import { toUUID } from '../../../shared/types/UUID.js';

const makeItem = (unitPrice = 100, quantity = 1) =>
  new QuoteItem({ description: 'Service', unitPrice, quantity, type: ItemType.SERVICE });

const makeQuote = (overrides: Partial<ConstructorParameters<typeof Quote>[0]> = {}) =>
  new Quote({
    serviceOrderId: toUUID('so-1'),
    customerId: toUUID('cust-1'),
    items: [makeItem(100, 2)],
    ...overrides,
  });

describe('Quote', () => {
  describe('constructor', () => {
    it('generates an id and sets PENDING status by default', () => {
      const quote = makeQuote();
      expect(quote.id).toBeDefined();
      expect(quote.id).toHaveLength(36);
      expect(quote.status).toBe(QuoteStatus.PENDING);
    });

    it('uses provided id and status', () => {
      const quote = makeQuote({ id: toUUID('fixed-id'), status: QuoteStatus.APPROVED });
      expect(quote.id).toBe('fixed-id');
      expect(quote.status).toBe(QuoteStatus.APPROVED);
    });

    it('calculates totalAmount as sum of item subtotals', () => {
      const items = [makeItem(100, 2), makeItem(50, 3)];
      const quote = makeQuote({ items });
      expect(quote.totalAmount).toBe(350); // 200 + 150
    });

    it('sets totalAmount to 0 when no items', () => {
      const quote = makeQuote({ items: [] });
      expect(quote.totalAmount).toBe(0);
    });

    it('preserves createdAt when provided', () => {
      const date = new Date('2026-01-01');
      const quote = makeQuote({ createdAt: date });
      expect(quote.createdAt).toBe(date);
    });

    it('sets createdAt to now when not provided', () => {
      const before = new Date();
      const quote = makeQuote();
      expect(quote.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('approve', () => {
    it('transitions PENDING → APPROVED', () => {
      const quote = makeQuote();
      quote.approve();
      expect(quote.status).toBe(QuoteStatus.APPROVED);
    });

    it.each([QuoteStatus.APPROVED, QuoteStatus.REJECTED])(
      'throws QuoteAlreadyProcessedException when status is %s',
      (status) => {
        const quote = makeQuote({ status });
        expect(() => quote.approve()).toThrow(QuoteAlreadyProcessedException);
      },
    );

    it('throws with statusCode 409', () => {
      const quote = makeQuote({ status: QuoteStatus.APPROVED });
      expect(() => quote.approve()).toThrow(expect.objectContaining({ statusCode: 409 }));
    });
  });

  describe('reject', () => {
    it('transitions PENDING → REJECTED', () => {
      const quote = makeQuote();
      quote.reject();
      expect(quote.status).toBe(QuoteStatus.REJECTED);
    });

    it.each([QuoteStatus.APPROVED, QuoteStatus.REJECTED])(
      'throws QuoteAlreadyProcessedException when status is %s',
      (status) => {
        const quote = makeQuote({ status });
        expect(() => quote.reject()).toThrow(QuoteAlreadyProcessedException);
      },
    );
  });
});
