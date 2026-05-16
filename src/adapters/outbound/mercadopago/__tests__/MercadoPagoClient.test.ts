import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MercadoPagoClient } from '../MercadoPagoClient.js';
import { MercadoPagoUnavailableError } from '../MercadoPagoUnavailableError.js';
import { env } from '../../../../shared/config/env.js';

vi.mock('../../../../shared/config/env.js', () => ({
  env: {
    mercadoPagoMock: false,
    mercadoPagoToken: 'test-token',
    mercadoPagoWebhookUrl: '',
    nodeEnv: 'development',
    datadog: { service: 'test', env: 'test', version: '1.0.0' },
  },
}));

vi.spyOn(global, 'setTimeout').mockImplementation((fn) => { (fn as () => void)(); return 0 as unknown as ReturnType<typeof setTimeout>; });

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: vi.fn(),
  // eslint-disable-next-line object-shorthand
  Preference: vi.fn().mockImplementation(function () {
    return { create: mockCreate };
  }),
}));

beforeEach(() => {
  mockCreate.mockReset();
  env.mercadoPagoMock = false;
  env.mercadoPagoToken = 'test-token';
  env.mercadoPagoWebhookUrl = '';
  env.nodeEnv = 'development';
});

const mpPreferenceResult = (id: string) => ({
  id,
  init_point: `https://www.mercadopago.com.br/checkout?pref_id=${id}`,
  sandbox_init_point: `https://sandbox.mercadopago.com.br/checkout?pref_id=${id}`,
});

const mpError = (status: number) => Object.assign(new Error(`MP error ${status}`), { status });

describe('MercadoPagoClient', () => {
  describe('createCheckoutPreference', () => {
    it('returns mock data when mercadoPagoMock is enabled', async () => {
      env.mercadoPagoMock = true;

      const result = await new MercadoPagoClient().createCheckoutPreference(100, 'ref-1', []);

      expect(result.preferenceId).toMatch(/^MOCK-/);
      expect(result.checkoutUrl).toMatch(/^https:\/\/mock\.mercadopago/);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns sandbox_init_point as checkoutUrl in non-production', async () => {
      mockCreate.mockResolvedValueOnce(mpPreferenceResult('pref-42'));

      const result = await new MercadoPagoClient().createCheckoutPreference(100, 'ref-1', []);

      expect(result.preferenceId).toBe('pref-42');
      expect(result.checkoutUrl).toContain('sandbox.mercadopago');
    });

    it('returns init_point as checkoutUrl in production', async () => {
      env.nodeEnv = 'production';
      mockCreate.mockResolvedValueOnce(mpPreferenceResult('pref-42'));

      const result = await new MercadoPagoClient().createCheckoutPreference(100, 'ref-1', []);

      expect(result.checkoutUrl).toContain('www.mercadopago');
    });

    it('sends external_reference and items in the request body', async () => {
      mockCreate.mockResolvedValueOnce(mpPreferenceResult('pref-1'));

      await new MercadoPagoClient().createCheckoutPreference(100, 'so-abc', [
        { id: 'item-1', title: 'Oil change', description: 'Oil change', quantity: 1, unitPrice: 100, categoryId: 'services' },
      ]);

      const { body } = mockCreate.mock.calls[0][0];
      expect(body.external_reference).toBe('so-abc');
      expect(body.items).toHaveLength(1);
      expect(body.items[0]).toMatchObject({ id: 'item-1', title: 'Oil change', unit_price: 100, currency_id: 'BRL' });
    });

    it('sends payer email when provided', async () => {
      mockCreate.mockResolvedValueOnce(mpPreferenceResult('pref-1'));

      await new MercadoPagoClient().createCheckoutPreference(100, 'ref-1', [], { email: 'a@b.com' });

      const { body } = mockCreate.mock.calls[0][0];
      expect(body.payer).toEqual({ email: 'a@b.com' });
    });

    it('omits notification_url when MERCADO_PAGO_WEBHOOK_URL is empty', async () => {
      mockCreate.mockResolvedValueOnce(mpPreferenceResult('pref-1'));

      await new MercadoPagoClient().createCheckoutPreference(100, 'ref-1', []);

      const { body } = mockCreate.mock.calls[0][0];
      expect(body.notification_url).to.equal(undefined);
    });

    it('appends serviceOrderId to notification_url when MERCADO_PAGO_WEBHOOK_URL is set', async () => {
      env.mercadoPagoWebhookUrl = 'https://abcd.ngrok-free.app/webhook/mercadopago';
      mockCreate.mockResolvedValueOnce(mpPreferenceResult('pref-1'));

      await new MercadoPagoClient().createCheckoutPreference(100, 'so-xyz', []);

      const { body } = mockCreate.mock.calls[0][0];
      expect(body.notification_url).toBe('https://abcd.ngrok-free.app/webhook/mercadopago?serviceOrderId=so-xyz');
    });

    it('throws MercadoPagoUnavailableError on 4xx', async () => {
      mockCreate.mockRejectedValueOnce(mpError(422));

      await expect(new MercadoPagoClient().createCheckoutPreference(100, 'ref-1', [])).rejects.toThrow(MercadoPagoUnavailableError);
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it('retries on 5xx and succeeds eventually', async () => {
      mockCreate
        .mockRejectedValueOnce(mpError(503))
        .mockRejectedValueOnce(mpError(503))
        .mockResolvedValueOnce(mpPreferenceResult('pref-99'));

      const result = await new MercadoPagoClient().createCheckoutPreference(100, 'ref-1', []);

      expect(result.preferenceId).toBe('pref-99');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('throws MercadoPagoUnavailableError after exhausting all retries on 5xx', async () => {
      mockCreate.mockRejectedValue(mpError(503));

      await expect(new MercadoPagoClient().createCheckoutPreference(100, 'ref-1', [])).rejects.toThrow(MercadoPagoUnavailableError);
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });
});
