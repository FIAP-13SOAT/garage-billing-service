import { type UUID, newUUID } from '../../shared/types/UUID.js';
import { QuoteItem } from './QuoteItem.js';

export interface QuoteProps {
  id?: UUID;
  serviceOrderId: UUID;
  customerId: UUID;
  items: QuoteItem[];
  createdAt?: Date;
}

export class Quote {
  readonly id: UUID;
  readonly serviceOrderId: UUID;
  readonly customerId: UUID;
  readonly items: QuoteItem[];
  readonly totalAmount: number;
  readonly createdAt: Date;

  constructor(props: QuoteProps) {
    this.id = props.id ?? newUUID();
    this.serviceOrderId = props.serviceOrderId;
    this.customerId = props.customerId;
    this.items = props.items;
    this.totalAmount = props.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.createdAt = props.createdAt ?? new Date();
  }
}
