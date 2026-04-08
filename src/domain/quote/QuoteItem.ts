import { type UUID, newUUID } from '../../shared/types/UUID.js';
import { ItemType } from './ItemType.js';

export interface QuoteItemProps {
  id?: UUID;
  description: string;
  unitPrice: number;
  quantity: number;
  type: ItemType;
}

export class QuoteItem {
  readonly id: UUID;
  readonly description: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly type: ItemType;

  constructor(props: QuoteItemProps) {
    this.id = props.id ?? newUUID();
    this.description = props.description;
    this.unitPrice = props.unitPrice;
    this.quantity = props.quantity;
    this.type = props.type;
  }

  get subtotal(): number {
    return this.unitPrice * this.quantity;
  }
}
