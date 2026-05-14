import type { UUID } from '../../shared/types/UUID.js';

// ── Commands received from billing.commands ──────────────────────────────────

export const BillingCommand = {
  GERAR_ORCAMENTO: 'GERAR_ORCAMENTO',
  CANCELAR_PAGAMENTO: 'CANCELAR_PAGAMENTO',
} as const;
export type BillingCommand = (typeof BillingCommand)[keyof typeof BillingCommand];

// ── Replies sent to billing.replies ─────────────────────────────────────────

export const BillingReply = {
  ORCAMENTO_GERADO: 'ORCAMENTO_GERADO',
  PAGAMENTO_CONFIRMADO: 'PAGAMENTO_CONFIRMADO',
  PAGAMENTO_RECUSADO: 'PAGAMENTO_RECUSADO',
  PAGAMENTO_CANCELADO: 'PAGAMENTO_CANCELADO',
} as const;
export type BillingReply = (typeof BillingReply)[keyof typeof BillingReply];

// ── Message envelope ─────────────────────────────────────────────────────────

export interface SagaMessage<T = unknown> {
  type: string;
  payload: T;
}

// ── Incoming payloads ────────────────────────────────────────────────────────

export interface GerarOrcamentoPayload {
  serviceOrderId: UUID;
  customerId: UUID;
  items: Array<{
    description: string;
    unitPrice: number;
    quantity: number;
    type: 'SERVICE' | 'STOCK_ITEM';
  }>;
  payerEmail?: string;
  payerFirstName?: string;
  payerLastName?: string;
  payerDocument?: string;
}

export interface CancelarPagamentoPayload {
  serviceOrderId: UUID;
}

// ── Outgoing payloads ────────────────────────────────────────────────────────

export interface OrcamentoGeradoPayload {
  serviceOrderId: UUID;
  quoteId: UUID;
  paymentId: UUID;
  totalAmount: number;
  paymentLink: string | null;
  qrCode: string | null;
}

export interface PagamentoConfirmadoPayload {
  serviceOrderId: UUID;
  paymentId: UUID;
}

export interface PagamentoRecusadoPayload {
  serviceOrderId: UUID;
  reason: string;
}

export interface PagamentoCanceladoPayload {
  serviceOrderId: UUID;
}
