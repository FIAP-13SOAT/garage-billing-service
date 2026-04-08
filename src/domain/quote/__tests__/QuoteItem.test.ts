import { describe, it, expect } from 'vitest';
import { QuoteItem } from '../QuoteItem.js';
import { ItemType } from '../ItemType.js';
import { toUUID } from '../../../shared/types/UUID.js';

const makeItem = (overrides: Partial<ConstructorParameters<typeof QuoteItem>[0]> = {}) =>
  new QuoteItem({ description: 'Oil change', unitPrice: 50, quantity: 1, type: ItemType.SERVICE, ...overrides });

describe('QuoteItem', () => {
  it('generates an id when none provided', () => {
    const item = makeItem();
    expect(item.id).toBeDefined();
    expect(item.id).toHaveLength(36);
  });

  it('uses provided id', () => {
    const item = makeItem({ id: toUUID('fixed-id') });
    expect(item.id).toBe('fixed-id');
  });

  it('preserves all fields', () => {
    const item = makeItem({ description: 'Brake pads', unitPrice: 120, quantity: 2, type: ItemType.STOCK_ITEM });
    expect(item.description).toBe('Brake pads');
    expect(item.unitPrice).toBe(120);
    expect(item.quantity).toBe(2);
    expect(item.type).toBe(ItemType.STOCK_ITEM);
  });

  describe('subtotal', () => {
    it('returns unitPrice * quantity', () => {
      const item = makeItem({ unitPrice: 30, quantity: 3 });
      expect(item.subtotal).toBe(90);
    });

    it('returns unitPrice when quantity is 1', () => {
      const item = makeItem({ unitPrice: 100, quantity: 1 });
      expect(item.subtotal).toBe(100);
    });
  });
});
