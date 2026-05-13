import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoClient } from '../MercadoPagoClient.js';
import { MercadoPagoUnavailableError } from '../MercadoPagoUnavailableError.js';
import { env } from '../../../../shared/config/env.js';

vi.mock('../../../../shared/config/env.js', () => ({
  env: { mercadoPagoMock: false, mercadoPagoToken: 'test-token', mercadoPagoWebhookUrl: '' },
}));

// make all setTimeout delays instant so retry tests don't slow the suite
vi.spyOn(global, 'setTimeout').mockImplementation((fn) => { (fn as () => void)(); return 0 as unknown as ReturnType<typeof setTimeout>; });

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  env.mercadoPagoMock = false;
  env.mercadoPagoToken = 'test-token';
  env.mercadoPagoWebhookUrl = '';
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

const mpPixBody = (id: number) => ({
  id,
  point_of_interaction: {
    transaction_data: {
      qr_code: 'QR',
      qr_code_base64: 'B64',
      ticket_url: `https://mp/checkout/${id}`,
    },
  },
});

describe('MercadoPagoClient', () => {
  describe('createPixPayment', () => {
    it('returns mock data when mercadoPagoMock is enabled', async () => {
      env.mercadoPagoMock = true;

      const result = await new MercadoPagoClient().createPixPayment(100);

      expect(result.mercadoPagoId).toMatch(/^MOCK-/);
      expect(result.paymentLink).toMatch(/^https:\/\/mock\.mercadopago/);
      expect(result.qrCode).toBe('MOCK-QR-CODE');
      expect(result.qrCodeBase64).toBe('MOCK-QR-BASE64');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns mercadoPagoId and link/qr from MP response', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(mpPixBody(42)));

      const result = await new MercadoPagoClient().createPixPayment(100);

      expect(result.mercadoPagoId).toBe('42');
      expect(result.paymentLink).toBe('https://mp/checkout/42');
      expect(result.qrCode).toBe('QR');
      expect(result.qrCodeBase64).toBe('B64');
    });

    it('sends payer identification when document is provided', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(mpPixBody(1)));

      await new MercadoPagoClient().createPixPayment(100, { email: 'a@b.com', document: '12345678900' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.payer.identification).toEqual({ type: 'CPF', number: '12345678900' });
    });

    it('omits notification_url when MERCADO_PAGO_WEBHOOK_URL is empty', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(mpPixBody(1)));

      await new MercadoPagoClient().createPixPayment(100);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.notification_url).to.equal(undefined);
    });

    it('forwards notification_url when MERCADO_PAGO_WEBHOOK_URL is set', async () => {
      env.mercadoPagoWebhookUrl = 'https://abcd.ngrok-free.app/webhook/mercadopago';
      mockFetch.mockResolvedValueOnce(okResponse(mpPixBody(1)));

      await new MercadoPagoClient().createPixPayment(100);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.notification_url).toBe('https://abcd.ngrok-free.app/webhook/mercadopago');
    });

    it('throws MercadoPagoUnavailableError on 4xx (creation rejected)', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(422));

      await expect(new MercadoPagoClient().createPixPayment(100)).rejects.toThrow(MercadoPagoUnavailableError);
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('retries on 5xx and succeeds eventually', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(503))
        .mockResolvedValueOnce(errorResponse(503))
        .mockResolvedValueOnce(okResponse(mpPixBody(99)));

      const result = await new MercadoPagoClient().createPixPayment(100);

      expect(result.mercadoPagoId).toBe('99');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws MercadoPagoUnavailableError after exhausting all retries on 5xx', async () => {
      mockFetch.mockResolvedValue(errorResponse(503));

      await expect(new MercadoPagoClient().createPixPayment(100)).rejects.toThrow(MercadoPagoUnavailableError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws MercadoPagoUnavailableError after exhausting retries on network failure', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      await expect(new MercadoPagoClient().createPixPayment(100)).rejects.toThrow(MercadoPagoUnavailableError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
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
