import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetPaymentStatusUseCase } from '../GetPaymentStatusUseCase.js';
import { Payment } from '../../../domain/payment/Payment.js';
import { PaymentStatus } from '../../../domain/payment/PaymentStatus.js';
import { PaymentNotFoundException } from '../exceptions/PaymentNotFoundException.js';
import type { PaymentGateway } from '../../../adapters/outbound/database/PaymentGateway.js';
import { toUUID } from '../../../shared/types/UUID.js';

const mockGateway = { save: vi.fn(), findById: vi.fn(), findByServiceOrderId: vi.fn() } as unknown as PaymentGateway;

beforeEach(() => { vi.clearAllMocks(); });

const command = { serviceOrderId: toUUID('so-1') };

describe('GetPaymentStatusUseCase', () => {
  it('returns the payment when found', async () => {
    const payment = new Payment({
      quoteId: toUUID('quote-1'),
      serviceOrderId: toUUID('so-1'),
      amount: 150,
      status: PaymentStatus.CONFIRMED,
    });
    vi.mocked(mockGateway.findByServiceOrderId).mockResolvedValue(payment);

    const result = await new GetPaymentStatusUseCase(mockGateway).execute(command);

    expect(result).toBe(payment);
    expect(result.status).toBe(PaymentStatus.CONFIRMED);
  });

  it('throws PaymentNotFoundException when payment does not exist', async () => {
    vi.mocked(mockGateway.findByServiceOrderId).mockResolvedValue(null);

    await expect(
      new GetPaymentStatusUseCase(mockGateway).execute(command),
    ).rejects.toThrow(PaymentNotFoundException);
  });

  it('PaymentNotFoundException has statusCode 404', async () => {
    vi.mocked(mockGateway.findByServiceOrderId).mockResolvedValue(null);

    await expect(
      new GetPaymentStatusUseCase(mockGateway).execute(command),
    ).rejects.toThrow(expect.objectContaining({ statusCode: 404 }));
  });
});
