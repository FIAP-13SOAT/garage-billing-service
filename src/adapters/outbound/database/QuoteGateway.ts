import type { PrismaClient } from '@prisma/client';
import { Quote } from '../../../domain/quote/Quote.js';
import { QuoteItem } from '../../../domain/quote/QuoteItem.js';
import { QuoteStatus } from '../../../domain/quote/QuoteStatus.js';
import { ItemType } from '../../../domain/quote/ItemType.js';
import { type UUID, toUUID } from '../../../shared/types/UUID.js';

export class QuoteGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(quote: Quote): Promise<Quote> {
    const record = await this.prisma.quote.upsert({
      where: { id: quote.id },
      create: {
        id: quote.id,
        serviceOrderId: quote.serviceOrderId,
        customerId: quote.customerId,
        totalAmount: quote.totalAmount,
        status: quote.status,
        items: {
          create: quote.items.map((item) => ({
            id: item.id,
            description: item.description,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            type: item.type,
          })),
        },
      },
      update: {
        status: quote.status,
      },
      include: { items: true },
    });
    return this.toEntity(record);
  }

  async findById(id: UUID): Promise<Quote | null> {
    const record = await this.prisma.quote.findUnique({
      where: { id },
      include: { items: true },
    });
    return record ? this.toEntity(record) : null;
  }

  async findByServiceOrderId(serviceOrderId: UUID): Promise<Quote | null> {
    const record = await this.prisma.quote.findUnique({
      where: { serviceOrderId },
      include: { items: true },
    });
    return record ? this.toEntity(record) : null;
  }

  private toEntity(record: {
    id: string;
    serviceOrderId: string;
    customerId: string;
    totalAmount: number;
    status: string;
    createdAt: Date;
    items: { id: string; description: string; unitPrice: number; quantity: number; type: string }[];
  }): Quote {
    const items = record.items.map(
      (i) =>
        new QuoteItem({
          id: toUUID(i.id),
          description: i.description,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          type: i.type as ItemType,
        }),
    );
    return new Quote({
      id: toUUID(record.id),
      serviceOrderId: toUUID(record.serviceOrderId),
      customerId: toUUID(record.customerId),
      items,
      status: record.status as QuoteStatus,
      createdAt: record.createdAt,
    });
  }
}
