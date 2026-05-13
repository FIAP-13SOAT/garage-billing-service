export class MercadoPagoUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Mercado Pago service unavailable after retries');
    this.name = 'MercadoPagoUnavailableError';
    this.cause = cause;
  }
}
