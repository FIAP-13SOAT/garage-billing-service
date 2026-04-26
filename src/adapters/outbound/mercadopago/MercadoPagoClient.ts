import { env } from '../../../shared/config/env.js';
import { newUUID } from '../../../shared/types/UUID.js';

export type PaymentResult = {
  mercadoPagoId: string;
  approved: boolean;
  qrCode?: string;
  qrCodeBase64?: string;
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

export class MercadoPagoClient {
  async processPayment(amount: number): Promise<PaymentResult> {
    if (env.mercadoPagoMock) {
      return {
        mercadoPagoId: `MOCK-${newUUID()}`,
        approved: true,
        qrCode: 'MOCK-QR-CODE',
        qrCodeBase64: 'MOCK-QR-BASE64',
      };
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

    const data = (await response.json()) as MpPaymentResponse;
    const txData = data.point_of_interaction?.transaction_data;

    return {
      mercadoPagoId: String(data.id),
      approved: data.status === 'approved',
      qrCode: txData?.qr_code,
      qrCodeBase64: txData?.qr_code_base64,
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
