import { type UUID, newUUID } from '../../shared/types/UUID.js';
import { PaymentStatus } from './PaymentStatus.js';
import { PaymentAlreadyProcessedException } from './exceptions/PaymentAlreadyProcessedException.js';
import { PaymentCannotBeCancelledException } from './exceptions/PaymentCannotBeCancelledException.js';

export interface PaymentProps {
  id?: UUID;
  quoteId: UUID;
  serviceOrderId: UUID;
  amount: number;
  status?: PaymentStatus;
  mercadoPagoId?: string;
  paymentLink?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  createdAt?: Date;
}

export class Payment {
  readonly id: UUID;
  readonly quoteId: UUID;
  readonly serviceOrderId: UUID;
  readonly amount: number;
  status: PaymentStatus;
  mercadoPagoId: string | null;
  paymentLink: string | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  readonly createdAt: Date;

  constructor(props: PaymentProps) {
    this.id = props.id ?? newUUID();
    this.quoteId = props.quoteId;
    this.serviceOrderId = props.serviceOrderId;
    this.amount = props.amount;
    this.status = props.status ?? PaymentStatus.PENDING;
    this.mercadoPagoId = props.mercadoPagoId ?? null;
    this.paymentLink = props.paymentLink ?? null;
    this.qrCode = props.qrCode ?? null;
    this.qrCodeBase64 = props.qrCodeBase64 ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }

  confirm(): void {
    if (this.status !== PaymentStatus.PENDING) {
      throw new PaymentAlreadyProcessedException(this.status);
    }
    this.status = PaymentStatus.CONFIRMED;
  }

  refuse(): void {
    if (this.status !== PaymentStatus.PENDING) {
      throw new PaymentAlreadyProcessedException(this.status);
    }
    this.status = PaymentStatus.REFUSED;
  }

  cancel(): void {
    if (this.status === PaymentStatus.REFUSED || this.status === PaymentStatus.CANCELLED) {
      throw new PaymentCannotBeCancelledException(this.status);
    }
    this.status = PaymentStatus.CANCELLED;
  }
}
