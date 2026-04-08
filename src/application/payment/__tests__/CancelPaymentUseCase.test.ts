import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CancelPaymentUseCase } from '../CancelPaymentUseCase.js';
import { Payment } from '../../../domain/payment/Payment.js';
import { PaymentStatus } from '../../../domain/payment/PaymentStatus.js';
import { PaymentNotFoundException } from '../exceptions/PaymentNotFoundException.js';
import { PaymentCannotBeCancelledException } from '../../../domain/payment/exceptions/PaymentCannotBeCancelledException.js';
import type { PaymentGateway } from '../../../adapters/outbound/database/PaymentGateway.js';
import type { MercadoPagoClient } from '../../../adapters/outbound/mercadopago/MercadoPagoClient.js';
import { toUUID } from '../../../shared/types/UUID.js';

const mockGateway = { save: vi.fn(), findById: vi.fn(), findByServiceOrderId: vi.fn() } as unknown as PaymentGateway;
const mockMpClient = { processPayment: vi.fn(), cancelPayment: vi.fn() } as unknown as MercadoPagoClient;

beforeEach(() => { vi.clearAllMocks(); });

const command = { serviceOrderId: toUUID('so-1') };

const makePayment = (status = PaymentStatus.CONFIRMED, mercadoPagoId: string | null = 'MP-123') =>
  new Payment({ quoteId: toUUID('quote-1'), serviceOrderId: toUUID('so-1'), amount: 100, status, mercadoPagoId: mercadoPagoId ?? undefined });

describe('CancelPaymentUseCase', () => {
  it('cancels a CONFIRMED payment and calls MercadoPago', async () => {
    const payment = makePayment();
    vi.mocked(mockGateway.findByServiceOrderId).mockResolvedValue(payment);
    vi.mocked(mockGateway.save).mockImplementation(async (p) => p);

    const result = await new CancelPaymentUseCase(mockGateway, mockMpClient).execute(command);

    expect(result.status).toBe(PaymentStatus.CANCELLED);
    expect(mockMpClient.cancelPayment).toHaveBeenCalledWith('MP-123');
  });

  it('cancels a PENDING payment without calling MercadoPago (no mercadoPagoId)', async () => {
    const payment = makePayment(PaymentStatus.PENDING, null);
    vi.mocked(mockGateway.findByServiceOrderId).mockResolvedValue(payment);
    vi.mocked(mockGateway.save).mockImplementation(async (p) => p);

    const result = await new CancelPaymentUseCase(mockGateway, mockMpClient).execute(command);

    expect(result.status).toBe(PaymentStatus.CANCELLED);
    expect(mockMpClient.cancelPayment).not.toHaveBeenCalled();
  });

  it('throws PaymentNotFoundException when payment does not exist', async () => {
    vi.mocked(mockGateway.findByServiceOrderId).mockResolvedValue(null);

    await expect(
      new CancelPaymentUseCase(mockGateway, mockMpClient).execute(command),
    ).rejects.toThrow(PaymentNotFoundException);
    expect(mockMpClient.cancelPayment).not.toHaveBeenCalled();
  });

  it('propagates PaymentCannotBeCancelledException from domain', async () => {
    const payment = makePayment(PaymentStatus.REFUSED);
    vi.mocked(mockGateway.findByServiceOrderId).mockResolvedValue(payment);

    await expect(
      new CancelPaymentUseCase(mockGateway, mockMpClient).execute(command),
    ).rejects.toThrow(PaymentCannotBeCancelledException);
    expect(mockGateway.save).not.toHaveBeenCalled();
  });
});
