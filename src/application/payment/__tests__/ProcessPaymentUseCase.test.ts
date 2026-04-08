import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessPaymentUseCase } from '../ProcessPaymentUseCase.js';
import { Payment } from '../../../domain/payment/Payment.js';
import { PaymentStatus } from '../../../domain/payment/PaymentStatus.js';
import { Quote } from '../../../domain/quote/Quote.js';
import { QuoteStatus } from '../../../domain/quote/QuoteStatus.js';
import { QuoteNotFoundException } from '../../quote/exceptions/QuoteNotFoundException.js';
import type { PaymentGateway } from '../../../adapters/outbound/database/PaymentGateway.js';
import type { QuoteGateway } from '../../../adapters/outbound/database/QuoteGateway.js';
import type { MercadoPagoClient } from '../../../adapters/outbound/mercadopago/MercadoPagoClient.js';
import { toUUID } from '../../../shared/types/UUID.js';

const mockPaymentGateway = { save: vi.fn(), findById: vi.fn(), findByServiceOrderId: vi.fn() } as unknown as PaymentGateway;
const mockQuoteGateway = { save: vi.fn(), findById: vi.fn(), findByServiceOrderId: vi.fn() } as unknown as QuoteGateway;
const mockMpClient = { processPayment: vi.fn(), cancelPayment: vi.fn() } as unknown as MercadoPagoClient;

beforeEach(() => { vi.clearAllMocks(); });

const command = { quoteId: toUUID('quote-1'), serviceOrderId: toUUID('so-1') };

const makeQuote = (status = QuoteStatus.APPROVED) =>
  new Quote({ serviceOrderId: toUUID('so-1'), customerId: toUUID('cust-1'), items: [], status });

describe('ProcessPaymentUseCase', () => {
  it('confirms payment when MercadoPago approves', async () => {
    vi.mocked(mockQuoteGateway.findById).mockResolvedValue(makeQuote());
    vi.mocked(mockMpClient.processPayment).mockResolvedValue({ mercadoPagoId: 'MP-123', approved: true });
    vi.mocked(mockPaymentGateway.save).mockImplementation(async (p) => p);

    const result = await new ProcessPaymentUseCase(mockPaymentGateway, mockQuoteGateway, mockMpClient).execute(command);

    expect(result.status).toBe(PaymentStatus.CONFIRMED);
    expect(result.mercadoPagoId).toBe('MP-123');
    expect(mockPaymentGateway.save).toHaveBeenCalledOnce();
  });

  it('refuses payment when MercadoPago rejects', async () => {
    vi.mocked(mockQuoteGateway.findById).mockResolvedValue(makeQuote());
    vi.mocked(mockMpClient.processPayment).mockResolvedValue({ mercadoPagoId: '', approved: false });
    vi.mocked(mockPaymentGateway.save).mockImplementation(async (p) => p);

    const result = await new ProcessPaymentUseCase(mockPaymentGateway, mockQuoteGateway, mockMpClient).execute(command);

    expect(result.status).toBe(PaymentStatus.REFUSED);
    expect(result.mercadoPagoId).toBeNull();
  });

  it('throws QuoteNotFoundException when quote does not exist', async () => {
    vi.mocked(mockQuoteGateway.findById).mockResolvedValue(null);

    await expect(
      new ProcessPaymentUseCase(mockPaymentGateway, mockQuoteGateway, mockMpClient).execute(command),
    ).rejects.toThrow(QuoteNotFoundException);
    expect(mockMpClient.processPayment).not.toHaveBeenCalled();
  });

  it('throws 422 when quote is not APPROVED', async () => {
    vi.mocked(mockQuoteGateway.findById).mockResolvedValue(makeQuote(QuoteStatus.PENDING));

    await expect(
      new ProcessPaymentUseCase(mockPaymentGateway, mockQuoteGateway, mockMpClient).execute(command),
    ).rejects.toThrow(expect.objectContaining({ statusCode: 422 }));
    expect(mockMpClient.processPayment).not.toHaveBeenCalled();
  });

  it('uses quote totalAmount as payment amount', async () => {
    const quote = new Quote({
      serviceOrderId: toUUID('so-1'),
      customerId: toUUID('cust-1'),
      items: [],
      status: QuoteStatus.APPROVED,
    });
    Object.defineProperty(quote, 'totalAmount', { value: 350 });
    vi.mocked(mockQuoteGateway.findById).mockResolvedValue(quote);
    vi.mocked(mockMpClient.processPayment).mockResolvedValue({ mercadoPagoId: 'MP-x', approved: true });
    vi.mocked(mockPaymentGateway.save).mockImplementation(async (p) => p);

    await new ProcessPaymentUseCase(mockPaymentGateway, mockQuoteGateway, mockMpClient).execute(command);

    expect(mockMpClient.processPayment).toHaveBeenCalledWith(350);
  });

  it('saves a Payment entity', async () => {
    vi.mocked(mockQuoteGateway.findById).mockResolvedValue(makeQuote());
    vi.mocked(mockMpClient.processPayment).mockResolvedValue({ mercadoPagoId: 'MP-1', approved: true });
    vi.mocked(mockPaymentGateway.save).mockImplementation(async (p) => p);

    await new ProcessPaymentUseCase(mockPaymentGateway, mockQuoteGateway, mockMpClient).execute(command);

    const [saved] = vi.mocked(mockPaymentGateway.save).mock.calls[0]!;
    expect(saved).toBeInstanceOf(Payment);
  });
});
