import { env } from '../../../shared/config/env.js';
import { newUUID } from '../../../shared/types/UUID.js';
import { MercadoPagoUnavailableError } from './MercadoPagoUnavailableError.js';

export type Payer = {
  email: string;
  document?: string;
};

export type PixPaymentResult = {
  mercadoPagoId: string;
  paymentLink: string;
  qrCode: string;
  qrCodeBase64: string;
};

type MpPaymentResponse = {
  id: number;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable = err instanceof TypeError || (err instanceof Error && err.message.includes('fetch'));
      if (!isRetryable) throw err;
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      console.error(`[MercadoPagoClient] ${label} attempt ${attempt} failed, retrying in ${delay}ms:`, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new MercadoPagoUnavailableError(lastError);
}

export class MercadoPagoClient {
  async createPixPayment(amount: number, payer?: Payer): Promise<PixPaymentResult> {
    if (env.mercadoPagoMock) {
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
    if (payer?.document) {
      payerPayload['identification'] = { type: 'CPF', number: payer.document };
    }

    return withRetry(async () => {
      const body: Record<string, unknown> = {
        transaction_amount: amount,
        payment_method_id: 'pix',
        payer: payerPayload,
      };
      if (env.mercadoPagoWebhookUrl) {
        body['notification_url'] = env.mercadoPagoWebhookUrl;
      }

      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.mercadoPagoToken}`,
        },
        body: JSON.stringify(body),
      });

      if (response.status >= 500) {
        throw new TypeError(`MP server error: ${response.status}`);
      }

      if (!response.ok) {
        const body = await response.text();
        console.error(`[MercadoPagoClient] createPixPayment failed: status=${response.status} body=${body}`);
        throw new MercadoPagoUnavailableError(new Error(`MP rejected payment creation: ${response.status}`));
      }

      const data = (await response.json()) as MpPaymentResponse;
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
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${mercadoPagoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.mercadoPagoToken}`,
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (response.status >= 500) {
        throw new TypeError(`MP server error: ${response.status}`);
      }
    }, 'cancelPayment');
  }
}
