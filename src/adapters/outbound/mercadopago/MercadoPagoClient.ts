import { MercadoPagoConfig, Preference } from 'mercadopago';
import { env } from '../../../shared/config/env.js';
import { Logger } from '../../../shared/logger/Logger.js';
import { newUUID } from '../../../shared/types/UUID.js';
import { MercadoPagoUnavailableError } from './MercadoPagoUnavailableError.js';

export type Payer = {
  email: string;
  firstName?: string;
  lastName?: string;
};

export type CheckoutItem = {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unitPrice: number;
  categoryId: string;
};

export type CheckoutPreferenceResult = {
  preferenceId: string;
  checkoutUrl: string;
};


const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

function isRetryableError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err != null && typeof err === 'object') {
    const status = (err as { status?: number }).status;
    return typeof status === 'number' && status >= 500;
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err)) throw new MercadoPagoUnavailableError(err);
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      Logger.error(`[MercadoPagoClient] ${label} attempt ${attempt} failed, retrying in ${delay}ms`, { error: err });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new MercadoPagoUnavailableError(lastError);
}

export class MercadoPagoClient {
  private preference: Preference;

  constructor() {
    const config = new MercadoPagoConfig({ accessToken: env.mercadoPagoToken });
    this.preference = new Preference(config);
  }

  async createCheckoutPreference(
    amount: number,
    externalReference: string,
    items: CheckoutItem[],
    payer?: Payer,
  ): Promise<CheckoutPreferenceResult> {
    if (env.mercadoPagoMock) {
      Logger.info('Mocking mercado pago integration');
      const id = `MOCK-${newUUID()}`;
      return {
        preferenceId: id,
        checkoutUrl: `https://mock.mercadopago/checkout/${id}`,
      };
    }

    return withRetry(async () => {
      const body = {
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          category_id: i.categoryId,
          currency_id: 'BRL',
        })),
        payer: payer ? { email: payer.email } : undefined,
        external_reference: externalReference,
        ...(env.mercadoPagoWebhookUrl ? { notification_url: `${env.mercadoPagoWebhookUrl}?serviceOrderId=${externalReference}` } : {}),
      };

      const data = await this.preference.create({ body });

      return {
        preferenceId: data.id ?? '',
        checkoutUrl: env.nodeEnv === 'production'
          ? (data.init_point ?? '')
          : (data.sandbox_init_point ?? ''),
      };
    }, 'createCheckoutPreference');
  }

}
