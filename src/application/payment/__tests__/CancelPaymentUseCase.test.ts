import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CancelPaymentUseCase } from '../CancelPaymentUseCase.js';
import { Payment } from '../../../domain/payment/Payment.js';
import { PaymentStatus } from '../../../domain/payment/PaymentStatus.js';
import { PaymentNotFoundException } from '../exceptions/PaymentNotFoundException.js';
import { PaymentCannotBeCancelledException } from '../../../domain/payment/exceptions/PaymentCannotBeCancelledException.js';
import type { PaymentGateway } from '../../../adapters/outbound/database/PaymentGateway.js';
import { toUUID } from '../../../shared/types/UUID.js';

const mockGateway = { save: vi.fn(), findById: vi.fn(), findByServiceOrderId: vi.fn() } as unknown as PaymentGateway;

beforeEach(() => { vi.clearAllMocks(); });

const command = { serviceOrderId: toUUID('so-1') };

const makePayment = (status = PaymentStatus.CONFIRMED) =>
  new Payment({ quoteId: toUUID('quote-1'), serviceOrderId: toUUID('so-1'), amount: 100, status });

describe('CancelPaymentUseCase', () => {
  it('cancels a CONFIRMED payment', async () => {
    const payment = makePayment();
    vi.mocked(mockGateway.findByServiceOrderId).mockResolvedValue(payment);
    vi.mocked(mockGateway.save).mockImplementation(async (p) => p);

    const result = await new CancelPaymentUseCase(mockGateway).execute(command);

    expect(result.status).toBe(PaymentStatus.CANCELLED);
    expect(mockGateway.save).toHaveBeenCalledOnce();
  });

  it('cancels a PENDING payment', async () => {
    const payment = makePayment(PaymentStatus.PENDING);
    vi.mocked(mockGateway.findByServiceOrderId).mockResolvedValue(payment);
    vi.mocked(mockGateway.save).mockImplementation(async (p) => p);

    const result = await new CancelPaymentUseCase(mockGateway).execute(command);

    expect(result.status).toBe(PaymentStatus.CANCELLED);
  });

  it('throws PaymentNotFoundException when payment does not exist', async () => {
    vi.mocked(mockGateway.findByServiceOrderId).mockResolvedValue(null);

    await expect(
      new CancelPaymentUseCase(mockGateway).execute(command),
    ).rejects.toThrow(PaymentNotFoundException);
  });

  it('propagates PaymentCannotBeCancelledException from domain', async () => {
    const payment = makePayment(PaymentStatus.REFUSED);
    vi.mocked(mockGateway.findByServiceOrderId).mockResolvedValue(payment);

    await expect(
      new CancelPaymentUseCase(mockGateway).execute(command),
    ).rejects.toThrow(PaymentCannotBeCancelledException);
    expect(mockGateway.save).not.toHaveBeenCalled();
  });
});
