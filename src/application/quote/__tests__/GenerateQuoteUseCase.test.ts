import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateQuoteUseCase } from '../GenerateQuoteUseCase.js';
import { Quote } from '../../../domain/quote/Quote.js';
import { Payment } from '../../../domain/payment/Payment.js';
import { ItemType } from '../../../domain/quote/ItemType.js';
import type { QuoteGateway } from '../../../adapters/outbound/database/QuoteGateway.js';
import type { PaymentGateway } from '../../../adapters/outbound/database/PaymentGateway.js';
import type { MercadoPagoClient } from '../../../adapters/outbound/mercadopago/MercadoPagoClient.js';
import { toUUID } from '../../../shared/types/UUID.js';

const mockQuoteGateway = {
  save: vi.fn(),
  findById: vi.fn(),
  findByServiceOrderId: vi.fn(),
} as unknown as QuoteGateway;

const mockPaymentGateway = {
  save: vi.fn(),
  findById: vi.fn(),
  findByServiceOrderId: vi.fn(),
  findByMercadoPagoId: vi.fn(),
} as unknown as PaymentGateway;

const mockMpClient = {
  createPixPayment: vi.fn(),
} as unknown as MercadoPagoClient;

const mpResult = {
  mercadoPagoId: 'MP-1',
  paymentLink: 'https://mp/checkout/MP-1',
  qrCode: 'QR',
  qrCodeBase64: 'B64',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mockQuoteGateway.save).mockImplementation(async (q) => q);
  vi.mocked(mockPaymentGateway.save).mockImplementation(async (p) => p);
  vi.mocked(mockMpClient.createPixPayment).mockResolvedValue(mpResult);
});

const command = {
  serviceOrderId: toUUID('so-1'),
  customerId: toUUID('cust-1'),
  items: [
    { description: 'Oil change', unitPrice: 80, quantity: 1, type: ItemType.SERVICE },
    { description: 'Oil filter', unitPrice: 20, quantity: 2, type: ItemType.STOCK_ITEM },
  ],
};

describe('GenerateQuoteUseCase', () => {
  it('saves Quote, creates MP PIX and persists Payment with link/QR', async () => {
    const result = await new GenerateQuoteUseCase(
      mockQuoteGateway,
      mockPaymentGateway,
      mockMpClient,
    ).execute(command);

    expect(mockQuoteGateway.save).toHaveBeenCalledOnce();
    expect(mockMpClient.createPixPayment).toHaveBeenCalledWith(
      120,
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ title: 'Oil change', quantity: 1, unitPrice: 80, categoryId: 'services' }),
        expect.objectContaining({ title: 'Oil filter', quantity: 2, unitPrice: 20, categoryId: 'vehicles' }),
      ]),
      undefined,
    );
    expect(mockPaymentGateway.save).toHaveBeenCalledOnce();

    expect(result.quote).toBeInstanceOf(Quote);
    expect(result.quote.totalAmount).toBe(120);
    expect(result.payment).toBeInstanceOf(Payment);
    expect(result.payment.mercadoPagoId).toBe('MP-1');
    expect(result.payment.paymentLink).toBe('https://mp/checkout/MP-1');
    expect(result.payment.qrCode).toBe('QR');
    expect(result.payment.qrCodeBase64).toBe('B64');
    expect(result.payment.quoteId).toBe(result.quote.id);
  });

  it('forwards payer email and document to MP when provided', async () => {
    await new GenerateQuoteUseCase(mockQuoteGateway, mockPaymentGateway, mockMpClient).execute({
      ...command,
      payerEmail: 'a@b.com',
      payerDocument: '12345678900',
    });

    expect(mockMpClient.createPixPayment).toHaveBeenCalledWith(
      120,
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({ email: 'a@b.com', document: '12345678900' }),
    );
  });

  it('creates Quote with zero total when items list is empty', async () => {
    const result = await new GenerateQuoteUseCase(
      mockQuoteGateway,
      mockPaymentGateway,
      mockMpClient,
    ).execute({ ...command, items: [] });

    expect(result.quote.totalAmount).toBe(0);
    expect(mockMpClient.createPixPayment).toHaveBeenCalledWith(0, expect.any(String), [], undefined);
  });
});
