import { describe, it, expect } from 'vitest';
import { Payment } from '../Payment.js';
import { PaymentStatus } from '../PaymentStatus.js';
import { PaymentAlreadyProcessedException } from '../exceptions/PaymentAlreadyProcessedException.js';
import { PaymentCannotBeCancelledException } from '../exceptions/PaymentCannotBeCancelledException.js';
import { toUUID } from '../../../shared/types/UUID.js';

const makePayment = (overrides: Partial<ConstructorParameters<typeof Payment>[0]> = {}) =>
  new Payment({
    quoteId: toUUID('quote-1'),
    serviceOrderId: toUUID('so-1'),
    amount: 200,
    ...overrides,
  });

describe('Payment', () => {
  describe('constructor', () => {
    it('generates an id and defaults to PENDING status', () => {
      const payment = makePayment();
      expect(payment.id).toBeDefined();
      expect(payment.id).toHaveLength(36);
      expect(payment.status).toBe(PaymentStatus.PENDING);
    });

    it('uses provided id and status', () => {
      const payment = makePayment({ id: toUUID('fixed-id'), status: PaymentStatus.CONFIRMED });
      expect(payment.id).toBe('fixed-id');
      expect(payment.status).toBe(PaymentStatus.CONFIRMED);
    });

    it('defaults mercadoPagoId, qrCode and qrCodeBase64 to null', () => {
      const payment = makePayment();
      expect(payment.mercadoPagoId).toBeNull();
      expect(payment.qrCode).toBeNull();
      expect(payment.qrCodeBase64).toBeNull();
    });

    it('preserves provided mercadoPagoId', () => {
      const payment = makePayment({ mercadoPagoId: 'MP-123' });
      expect(payment.mercadoPagoId).toBe('MP-123');
    });
  });

  describe('confirm', () => {
    it('transitions PENDING → CONFIRMED and sets mercadoPagoId', () => {
      const payment = makePayment();
      payment.confirm('MP-999');
      expect(payment.status).toBe(PaymentStatus.CONFIRMED);
      expect(payment.mercadoPagoId).toBe('MP-999');
    });

    it('stores qrCode and qrCodeBase64 when provided', () => {
      const payment = makePayment();
      payment.confirm('MP-999', '00020126...pix', 'base64==');
      expect(payment.qrCode).toBe('00020126...pix');
      expect(payment.qrCodeBase64).toBe('base64==');
    });

    it('leaves qrCode null when not provided', () => {
      const payment = makePayment();
      payment.confirm('MP-999');
      expect(payment.qrCode).toBeNull();
      expect(payment.qrCodeBase64).toBeNull();
    });

    it.each([PaymentStatus.CONFIRMED, PaymentStatus.REFUSED, PaymentStatus.CANCELLED])(
      'throws PaymentAlreadyProcessedException when status is %s',
      (status) => {
        const payment = makePayment({ status });
        expect(() => payment.confirm('MP-999')).toThrow(PaymentAlreadyProcessedException);
      },
    );
  });

  describe('refuse', () => {
    it('transitions PENDING → REFUSED', () => {
      const payment = makePayment();
      payment.refuse();
      expect(payment.status).toBe(PaymentStatus.REFUSED);
    });

    it.each([PaymentStatus.CONFIRMED, PaymentStatus.REFUSED, PaymentStatus.CANCELLED])(
      'throws PaymentAlreadyProcessedException when status is %s',
      (status) => {
        const payment = makePayment({ status });
        expect(() => payment.refuse()).toThrow(PaymentAlreadyProcessedException);
      },
    );
  });

  describe('cancel', () => {
    it.each([PaymentStatus.PENDING, PaymentStatus.CONFIRMED])(
      'cancels from %s',
      (status) => {
        const payment = makePayment({ status });
        payment.cancel();
        expect(payment.status).toBe(PaymentStatus.CANCELLED);
      },
    );

    it.each([PaymentStatus.REFUSED, PaymentStatus.CANCELLED])(
      'throws PaymentCannotBeCancelledException when status is %s',
      (status) => {
        const payment = makePayment({ status });
        expect(() => payment.cancel()).toThrow(PaymentCannotBeCancelledException);
      },
    );

    it('throws with statusCode 409', () => {
      const payment = makePayment({ status: PaymentStatus.REFUSED });
      expect(() => payment.cancel()).toThrow(expect.objectContaining({ statusCode: 409 }));
    });
  });
});
