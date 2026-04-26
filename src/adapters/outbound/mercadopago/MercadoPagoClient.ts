import { env } from '../../../shared/config/env.js';
import { newUUID } from '../../../shared/types/UUID.js';

export type PaymentResult = {
  mercadoPagoId: string;
  approved: boolean;
};

export type PaymentStatusResult = {
  mercadoPagoId: string;
  status: 'approved' | 'pending' | 'rejected' | 'cancelled' | string;
};

export class MercadoPagoClient {
  async processPayment(amount: number): Promise<PaymentResult> {
    if (env.mercadoPagoMock) {
      return { mercadoPagoId: `MOCK-${newUUID()}`, approved: true };
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
        payer: { email: 'customer@garage.com' },
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
