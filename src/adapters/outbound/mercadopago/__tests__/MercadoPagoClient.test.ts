import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoClient } from '../MercadoPagoClient.js';
import { MercadoPagoUnavailableError } from '../MercadoPagoUnavailableError.js';

vi.stubEnv('MERCADO_PAGO_MOCK', 'false');
vi.stubEnv('MERCADO_PAGO_ACCESS_TOKEN', 'test-token');

// make all setTimeout delays instant so retry tests don't slow the suite
vi.spyOn(global, 'setTimeout').mockImplementation((fn) => { (fn as () => void)(); return 0 as unknown as ReturnType<typeof setTimeout>; });

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => { vi.clearAllMocks(); });

const okResponse = (body: object) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const errorResponse = (status: number) => ({
  ok: false,
  status,
  json: async () => ({}),
  text: async () => 'error',
});

describe('MercadoPagoClient', () => {
  describe('processPayment', () => {
    it('returns approved=true when MP responds with status approved', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ id: 42, status: 'approved' }));

      const result = await new MercadoPagoClient().processPayment(100);

      expect(result.approved).toBe(true);
      expect(result.mercadoPagoId).toBe('42');
    });

    it('returns approved=false without retry on 4xx (client error)', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(422));

      const result = await new MercadoPagoClient().processPayment(100);

      expect(result.approved).toBe(false);
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('retries on 5xx and returns approved on eventual success', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(503))
        .mockResolvedValueOnce(errorResponse(503))
        .mockResolvedValueOnce(okResponse({ id: 99, status: 'approved' }));

      const result = await new MercadoPagoClient().processPayment(100);

      expect(result.approved).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws MercadoPagoUnavailableError after exhausting all retries on 5xx', async () => {
      mockFetch.mockResolvedValue(errorResponse(503));

      await expect(new MercadoPagoClient().processPayment(100)).rejects.toThrow(MercadoPagoUnavailableError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws MercadoPagoUnavailableError after exhausting retries on network failure', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      await expect(new MercadoPagoClient().processPayment(100)).rejects.toThrow(MercadoPagoUnavailableError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
