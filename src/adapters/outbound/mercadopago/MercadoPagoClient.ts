import { MercadoPagoConfig, Payment } from 'mercadopago';
import type { PaymentCreateRequest } from 'mercadopago';
import { env } from '../../../shared/config/env.js';
import { Logger } from '../../../shared/logger/Logger.js';
import { newUUID } from '../../../shared/types/UUID.js';
import { MercadoPagoUnavailableError } from './MercadoPagoUnavailableError.js';

export type Payer = {
  email: string;
  firstName?: string;
  lastName?: string;
  document?: string;
};

export type PixPaymentItem = {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unitPrice: number;
  categoryId: string;
};

export type PixPaymentResult = {
  mercadoPagoId: string;
  paymentLink: string;
  qrCode: string;
  qrCodeBase64: string;
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
  private payment: Payment;

  constructor() {
    const config = new MercadoPagoConfig({ accessToken: env.mercadoPagoToken });
    this.payment = new Payment(config);
  }

  async createPixPayment(
    amount: number,
    externalReference: string,
    items: PixPaymentItem[],
    payer?: Payer,
  ): Promise<PixPaymentResult> {
    if (env.mercadoPagoMock) {
      Logger.info('Mocking mercado pago integration');
      const id = `MOCK-${newUUID()}`;
      return {
        mercadoPagoId: id,
        paymentLink: `https://mock.mercadopago/checkout/${id}`,
        qrCode: 'MOCK-QR-CODE',
        qrCodeBase64: 'MOCK-QR-BASE64',
      };
    }

    const payerPayload: Record<string, unknown> = {
      email: payer?.email ?? 'customer@garage.com',
    };

    if (payer?.firstName) payerPayload['first_name'] = payer.firstName;
    if (payer?.lastName) payerPayload['last_name'] = payer.lastName;
    if (payer?.document) {
      payerPayload['identification'] = { type: 'CPF', number: payer.document };
    }

    return withRetry(async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const body: PaymentCreateRequest = {
        transaction_amount: amount,
        payment_method_id: 'pix',
        date_of_expiration: expiresAt,
        external_reference: externalReference,
        payer: payerPayload as PaymentCreateRequest['payer'],
        additional_info: {
          items: items.map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            quantity: i.quantity,
            unit_price: i.unitPrice,
            category_id: i.categoryId,
          })),
        },
      };

      if (env.mercadoPagoWebhookUrl) {
        body.notification_url = env.mercadoPagoWebhookUrl;
      }

      const data = await this.payment.create({ body });
      const txData = data.point_of_interaction?.transaction_data;

      return {
        mercadoPagoId: String(data.id),
        paymentLink: txData?.ticket_url ?? '',
        qrCode: txData?.qr_code ?? '',
        qrCodeBase64: txData?.qr_code_base64 ?? '',
      };
    }, 'createPixPayment');
  }

  async cancelPayment(mercadoPagoId: string): Promise<void> {
    if (env.mercadoPagoMock) return;

    await withRetry(async () => {
      await this.payment.cancel({ id: Number(mercadoPagoId) });
    }, 'cancelPayment');
  }
}
