import { env } from '../../../shared/config/env.js';
import { newUUID } from '../../../shared/types/UUID.js';

export type Payer = {
  email: string;
  document?: string;
};

export type PaymentResult = {
  mercadoPagoId: string;
  approved: boolean;
};

export class MercadoPagoClient {
  async processPayment(amount: number, payer?: Payer): Promise<PaymentResult> {
    if (env.mercadoPagoMock) {
      return { mercadoPagoId: `MOCK-${newUUID()}`, approved: true };
    }

    const payerPayload: Record<string, unknown> = {
      email: payer?.email ?? 'customer@garage.com',
    };
    if (payer?.document) {
      payerPayload['identification'] = { type: 'CPF', number: payer.document };
    }

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

    if (!response.ok) {
      return { mercadoPagoId: '', approved: false };
    }

    const data = (await response.json()) as { id: number; status: string };
    return {
      mercadoPagoId: String(data.id),
      approved: data.status === 'approved',
    };
  }

  async cancelPayment(mercadoPagoId: string): Promise<void> {
    if (env.mercadoPagoMock) return;

    await fetch(`https://api.mercadopago.com/v1/payments/${mercadoPagoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.mercadoPagoToken}`,
      },
      body: JSON.stringify({ status: 'cancelled' }),
    });
  }
}
