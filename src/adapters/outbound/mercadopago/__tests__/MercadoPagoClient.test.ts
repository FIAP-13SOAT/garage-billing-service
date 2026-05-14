import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoClient } from '../MercadoPagoClient.js';
import { MercadoPagoUnavailableError } from '../MercadoPagoUnavailableError.js';
import { env } from '../../../../shared/config/env.js';

vi.mock('../../../../shared/config/env.js', () => ({
  env: {
    mercadoPagoMock: false,
    mercadoPagoToken: 'test-token',
    mercadoPagoWebhookUrl: '',
    datadog: { service: 'test', env: 'test', version: '1.0.0' },
  },
}));

// make all setTimeout delays instant so retry tests don't slow the suite
vi.spyOn(global, 'setTimeout').mockImplementation((fn) => { (fn as () => void)(); return 0 as unknown as ReturnType<typeof setTimeout>; });

const { mockCreate, mockCancel } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockCancel: vi.fn(),
}));

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: vi.fn(),
  // eslint-disable-next-line object-shorthand
  Payment: vi.fn().mockImplementation(function () {
    return { create: mockCreate, cancel: mockCancel };
  }),
}));

beforeEach(() => {
  mockCreate.mockReset();
  mockCancel.mockReset();
  env.mercadoPagoMock = false;
  env.mercadoPagoToken = 'test-token';
  env.mercadoPagoWebhookUrl = '';
});

const mpPixResult = (id: number) => ({
  id,
  point_of_interaction: {
    transaction_data: {
      qr_code: 'QR',
      qr_code_base64: 'B64',
      ticket_url: `https://mp/checkout/${id}`,
    },
  },
});

const mpError = (status: number) => Object.assign(new Error(`MP error ${status}`), { status });

describe('MercadoPagoClient', () => {
  describe('createPixPayment', () => {
    it('returns mock data when mercadoPagoMock is enabled', async () => {
      env.mercadoPagoMock = true;

      const result = await new MercadoPagoClient().createPixPayment(100, 'ref-1', []);

      expect(result.mercadoPagoId).toMatch(/^MOCK-/);
      expect(result.paymentLink).toMatch(/^https:\/\/mock\.mercadopago/);
      expect(result.qrCode).toBe('MOCK-QR-CODE');
      expect(result.qrCodeBase64).toBe('MOCK-QR-BASE64');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns mercadoPagoId and link/qr from MP response', async () => {
      mockCreate.mockResolvedValueOnce(mpPixResult(42));

      const result = await new MercadoPagoClient().createPixPayment(100, 'ref-1', []);

      expect(result.mercadoPagoId).toBe('42');
      expect(result.paymentLink).toBe('https://mp/checkout/42');
      expect(result.qrCode).toBe('QR');
      expect(result.qrCodeBase64).toBe('B64');
    });

    it('sends external_reference and items in the request body', async () => {
      mockCreate.mockResolvedValueOnce(mpPixResult(1));

      await new MercadoPagoClient().createPixPayment(100, 'quote-abc', [
        { id: 'item-1', title: 'Oil change', description: 'Oil change', quantity: 1, unitPrice: 100, categoryId: 'services' },
      ]);

      const { body } = mockCreate.mock.calls[0][0];
      expect(body.external_reference).toBe('quote-abc');
      expect(body.additional_info.items).toHaveLength(1);
      expect(body.additional_info.items[0]).toMatchObject({ id: 'item-1', title: 'Oil change', unit_price: 100 });
    });

    it('sets date_of_expiration 24h from now', async () => {
      mockCreate.mockResolvedValueOnce(mpPixResult(1));
      const before = Date.now();

      await new MercadoPagoClient().createPixPayment(100, 'ref-1', []);

      const { body } = mockCreate.mock.calls[0][0];
      const expiry = new Date(body.date_of_expiration).getTime();
      expect(expiry).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000 - 1000);
      expect(expiry).toBeLessThanOrEqual(before + 24 * 60 * 60 * 1000 + 1000);
    });

    it('sends payer identification when document is provided', async () => {
      mockCreate.mockResolvedValueOnce(mpPixResult(1));

      await new MercadoPagoClient().createPixPayment(100, 'ref-1', [], { email: 'a@b.com', document: '12345678900' });

      const { body } = mockCreate.mock.calls[0][0];
      expect(body.payer.identification).toEqual({ type: 'CPF', number: '12345678900' });
    });

    it('sends payer first_name and last_name when provided', async () => {
      mockCreate.mockResolvedValueOnce(mpPixResult(1));

      await new MercadoPagoClient().createPixPayment(100, 'ref-1', [], { email: 'a@b.com', firstName: 'João', lastName: 'Silva' });

      const { body } = mockCreate.mock.calls[0][0];
      expect(body.payer.first_name).toBe('João');
      expect(body.payer.last_name).toBe('Silva');
    });

    it('omits notification_url when MERCADO_PAGO_WEBHOOK_URL is empty', async () => {
      mockCreate.mockResolvedValueOnce(mpPixResult(1));

      await new MercadoPagoClient().createPixPayment(100, 'ref-1', []);

      const { body } = mockCreate.mock.calls[0][0];
      expect(body.notification_url).to.equal(undefined);
    });

    it('forwards notification_url when MERCADO_PAGO_WEBHOOK_URL is set', async () => {
      env.mercadoPagoWebhookUrl = 'https://abcd.ngrok-free.app/webhook/mercadopago';
      mockCreate.mockResolvedValueOnce(mpPixResult(1));

      await new MercadoPagoClient().createPixPayment(100, 'ref-1', []);

      const { body } = mockCreate.mock.calls[0][0];
      expect(body.notification_url).toBe('https://abcd.ngrok-free.app/webhook/mercadopago');
    });

    it('defaults paymentLink/qrCode/qrCodeBase64 to empty string when MP omits transaction data', async () => {
      mockCreate.mockResolvedValueOnce({ id: 7 });

      const result = await new MercadoPagoClient().createPixPayment(100, 'ref-1', []);

      expect(result.mercadoPagoId).toBe('7');
      expect(result.paymentLink).toBe('');
      expect(result.qrCode).toBe('');
      expect(result.qrCodeBase64).toBe('');
    });

    it('throws MercadoPagoUnavailableError on 4xx (creation rejected)', async () => {
      mockCreate.mockRejectedValueOnce(mpError(422));

      await expect(new MercadoPagoClient().createPixPayment(100, 'ref-1', [])).rejects.toThrow(MercadoPagoUnavailableError);
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('retries on 5xx and succeeds eventually', async () => {
      mockCreate
        .mockRejectedValueOnce(mpError(503))
        .mockRejectedValueOnce(mpError(503))
        .mockResolvedValueOnce(mpPixResult(99));

      const result = await new MercadoPagoClient().createPixPayment(100, 'ref-1', []);

      expect(result.mercadoPagoId).toBe('99');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('throws MercadoPagoUnavailableError after exhausting all retries on 5xx', async () => {
      mockCreate.mockRejectedValue(mpError(503));

      await expect(new MercadoPagoClient().createPixPayment(100, 'ref-1', [])).rejects.toThrow(MercadoPagoUnavailableError);
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('throws MercadoPagoUnavailableError after exhausting retries on network failure', async () => {
      mockCreate.mockRejectedValue(new TypeError('fetch failed'));

      await expect(new MercadoPagoClient().createPixPayment(100, 'ref-1', [])).rejects.toThrow(MercadoPagoUnavailableError);
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('cancelPayment', () => {
    it('does nothing when mercadoPagoMock is enabled', async () => {
      env.mercadoPagoMock = true;

      await expect(new MercadoPagoClient().cancelPayment('12345')).resolves.toBeUndefined();
      expect(mockCancel).not.toHaveBeenCalled();
    });

    it('sends cancel request to MP API with correct id', async () => {
      mockCancel.mockResolvedValueOnce({});

      await new MercadoPagoClient().cancelPayment('12345');

      expect(mockCancel).toHaveBeenCalledOnce();
      expect(mockCancel.mock.calls[0][0]).toEqual({ id: 12345 });
    });

    it('retries and succeeds on 5xx', async () => {
      mockCancel
        .mockRejectedValueOnce(mpError(503))
        .mockResolvedValueOnce({});

      await expect(new MercadoPagoClient().cancelPayment('12345')).resolves.toBeUndefined();
      expect(mockCancel).toHaveBeenCalledTimes(2);
    });
  });
});
