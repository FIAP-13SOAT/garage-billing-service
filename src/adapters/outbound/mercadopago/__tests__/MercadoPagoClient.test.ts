import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoClient } from '../MercadoPagoClient.js';
import { MercadoPagoUnavailableError } from '../MercadoPagoUnavailableError.js';
import { env } from '../../../../shared/config/env.js';

vi.mock('../../../../shared/config/env.js', () => ({
  env: { mercadoPagoMock: false, mercadoPagoToken: 'test-token' },
}));

// make all setTimeout delays instant so retry tests don't slow the suite
vi.spyOn(global, 'setTimeout').mockImplementation((fn) => { (fn as () => void)(); return 0 as unknown as ReturnType<typeof setTimeout>; });

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  env.mercadoPagoMock = false;
  env.mercadoPagoToken = 'test-token';
});

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
    it('returns mock data when mercadoPagoMock is enabled', async () => {
      env.mercadoPagoMock = true;

      const result = await new MercadoPagoClient().processPayment(100);

      expect(result.approved).toBe(true);
      expect(result.mercadoPagoId).toMatch(/^MOCK-/);
      expect(result.qrCode).toBe('MOCK-QR-CODE');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns approved=true when MP responds with status approved', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ id: 42, status: 'approved' }));

      const result = await new MercadoPagoClient().processPayment(100);

      expect(result.approved).toBe(true);
      expect(result.mercadoPagoId).toBe('42');
    });

    it('includes qrCode and qrCodeBase64 from point_of_interaction', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({
        id: 42,
        status: 'approved',
        point_of_interaction: { transaction_data: { qr_code: 'QR', qr_code_base64: 'B64' } },
      }));

      const result = await new MercadoPagoClient().processPayment(100);

      expect(result.qrCode).toBe('QR');
      expect(result.qrCodeBase64).toBe('B64');
    });

    it('sends payer identification when document is provided', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ id: 1, status: 'approved' }));

      await new MercadoPagoClient().processPayment(100, { email: 'a@b.com', document: '12345678900' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.payer.identification).toEqual({ type: 'CPF', number: '12345678900' });
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

  describe('getPayment', () => {
    it('returns approved status when mercadoPagoMock is enabled', async () => {
      env.mercadoPagoMock = true;

      const result = await new MercadoPagoClient().getPayment('MP-123');

      expect(result).toEqual({ mercadoPagoId: 'MP-123', status: 'approved' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns payment status from MP API', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ id: 77, status: 'pending' }));

      const result = await new MercadoPagoClient().getPayment('77');

      expect(result).toEqual({ mercadoPagoId: '77', status: 'pending' });
    });

    it('returns pending when MP API responds with non-ok status', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404));

      const result = await new MercadoPagoClient().getPayment('MP-999');

      expect(result).toEqual({ mercadoPagoId: 'MP-999', status: 'pending' });
    });
  });

  describe('cancelPayment', () => {
    it('does nothing when mercadoPagoMock is enabled', async () => {
      env.mercadoPagoMock = true;

      await expect(new MercadoPagoClient().cancelPayment('MP-123')).resolves.toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends cancel request to MP API', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await new MercadoPagoClient().cancelPayment('MP-123');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('MP-123');
      expect(opts.method).toBe('PUT');
    });

    it('retries and succeeds on 5xx', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await expect(new MercadoPagoClient().cancelPayment('MP-123')).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
