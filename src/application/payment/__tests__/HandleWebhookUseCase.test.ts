import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HandleWebhookUseCase } from '../HandleWebhookUseCase.js';
import { Payment } from '../../../domain/payment/Payment.js';
import { PaymentStatus } from '../../../domain/payment/PaymentStatus.js';
import type { PaymentGateway } from '../../../adapters/outbound/database/PaymentGateway.js';
import type { BillingReplyProducer } from '../../../adapters/outbound/messaging/BillingReplyProducer.js';
import { toUUID } from '../../../shared/types/UUID.js';

const mockGateway = {
  save: vi.fn(),
  findById: vi.fn(),
  findByServiceOrderId: vi.fn(),
  findByMercadoPagoId: vi.fn(),
} as unknown as PaymentGateway;

const mockReplyProducer = {
  sendPagamentoConfirmado: vi.fn(),
  sendPagamentoRecusado: vi.fn(),
  sendOrcamentoGerado: vi.fn(),
  sendPagamentoCancelado: vi.fn(),
} as unknown as BillingReplyProducer;

beforeEach(() => { vi.clearAllMocks(); });

const makePendingPayment = () =>
  new Payment({
    quoteId: toUUID('quote-1'),
    serviceOrderId: toUUID('so-1'),
    amount: 150,
    mercadoPagoId: 'MP-123',
  });

const useCase = () => new HandleWebhookUseCase(mockGateway, mockReplyProducer);

describe('HandleWebhookUseCase', () => {
  it('confirms payment and emits PAGAMENTO_CONFIRMADO when webhook arrives', async () => {
    const payment = makePendingPayment();
    vi.mocked(mockGateway.findByMercadoPagoId).mockResolvedValue(payment);
    vi.mocked(mockGateway.save).mockImplementation(async (p) => p);

    await useCase().execute({ mercadoPagoId: 'MP-123' });

    expect(payment.status).toBe(PaymentStatus.CONFIRMED);
    expect(mockGateway.save).toHaveBeenCalledOnce();
    expect(mockReplyProducer.sendPagamentoConfirmado).toHaveBeenCalledWith({
      serviceOrderId: toUUID('so-1'),
      paymentId: payment.id,
    });
  });

  it('is idempotent — ignores webhook when payment is already CONFIRMED', async () => {
    const payment = new Payment({
      quoteId: toUUID('quote-1'),
      serviceOrderId: toUUID('so-1'),
      amount: 150,
      mercadoPagoId: 'MP-123',
      status: PaymentStatus.CONFIRMED,
    });
    vi.mocked(mockGateway.findByMercadoPagoId).mockResolvedValue(payment);

    await useCase().execute({ mercadoPagoId: 'MP-123' });

    expect(mockGateway.save).not.toHaveBeenCalled();
    expect(mockReplyProducer.sendPagamentoConfirmado).not.toHaveBeenCalled();
  });

  it('ignores webhook when mercadoPagoId is not found in DB', async () => {
    vi.mocked(mockGateway.findByMercadoPagoId).mockResolvedValue(null);

    await useCase().execute({ mercadoPagoId: 'UNKNOWN-999' });

    expect(mockGateway.save).not.toHaveBeenCalled();
    expect(mockReplyProducer.sendPagamentoConfirmado).not.toHaveBeenCalled();
  });
});
