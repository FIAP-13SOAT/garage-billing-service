import { type UUID, newUUID } from '../../shared/types/UUID.js';
import { QuoteItem } from './QuoteItem.js';
import { QuoteStatus } from './QuoteStatus.js';
import { QuoteAlreadyProcessedException } from './exceptions/QuoteAlreadyProcessedException.js';

export interface QuoteProps {
  id?: UUID;
  serviceOrderId: UUID;
  customerId: UUID;
  items: QuoteItem[];
  status?: QuoteStatus;
  createdAt?: Date;
}

export class Quote {
  readonly id: UUID;
  readonly serviceOrderId: UUID;
  readonly customerId: UUID;
  readonly items: QuoteItem[];
  readonly totalAmount: number;
  status: QuoteStatus;
  readonly createdAt: Date;

  constructor(props: QuoteProps) {
    this.id = props.id ?? newUUID();
    this.serviceOrderId = props.serviceOrderId;
    this.customerId = props.customerId;
    this.items = props.items;
    this.totalAmount = props.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.status = props.status ?? QuoteStatus.PENDING;
    this.createdAt = props.createdAt ?? new Date();
  }

  approve(): void {
    if (this.status !== QuoteStatus.PENDING) {
      throw new QuoteAlreadyProcessedException(this.status);
    }
    this.status = QuoteStatus.APPROVED;
  }

  reject(): void {
    if (this.status !== QuoteStatus.PENDING) {
      throw new QuoteAlreadyProcessedException(this.status);
    }
    this.status = QuoteStatus.REJECTED;
  }
}
