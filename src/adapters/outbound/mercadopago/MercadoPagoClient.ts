import { env } from '../../../shared/config/env.js';
import { newUUID } from '../../../shared/types/UUID.js';
import { MercadoPagoUnavailableError } from './MercadoPagoUnavailableError.js';

export type Payer = {
  email: string;
  document?: string;
};

export type PaymentResult = {
  mercadoPagoId: string;
  approved: boolean;
  qrCode?: string;
  qrCodeBase64?: string;
};

export type PaymentStatusResult = {
  mercadoPagoId: string;
  status: 'approved' | 'pending' | 'rejected' | 'cancelled' | string;
};

type MpPaymentResponse = {
  id: number;
  status: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
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
  async processPayment(amount: number, payer?: Payer): Promise<PaymentResult> {
    if (env.mercadoPagoMock) {
      return {
        mercadoPagoId: `MOCK-${newUUID()}`,
        approved: true,
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
      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.mercadoPagoToken}`,
        },
        body: JSON.stringify({
          transaction_amount: amount,
          payment_method_id: 'pix',
          payer: payerPayload,
        }),
      });

      if (response.status >= 500) {
        throw new TypeError(`MP server error: ${response.status}`);
      }

      if (!response.ok) {
        const body = await response.text();
        console.error(`[MercadoPagoClient] processPayment rejected: status=${response.status} body=${body}`);
        return { mercadoPagoId: '', approved: false };
      }

      const data = (await response.json()) as MpPaymentResponse;
      const txData = data.point_of_interaction?.transaction_data;

      return {
        mercadoPagoId: String(data.id),
        approved: data.status === 'approved',
        qrCode: txData?.qr_code,
        qrCodeBase64: txData?.qr_code_base64,
      };
    }, 'processPayment');
  }

  async getPayment(mercadoPagoId: string): Promise<PaymentStatusResult> {
    if (env.mercadoPagoMock) {
      return { mercadoPagoId, status: 'approved' };
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${mercadoPagoId}`, {
      headers: { Authorization: `Bearer ${env.mercadoPagoToken}` },
    });

    if (!response.ok) {
      return { mercadoPagoId, status: 'pending' };
    }

    const data = (await response.json()) as { id: number; status: string };
    return { mercadoPagoId: String(data.id), status: data.status };
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
