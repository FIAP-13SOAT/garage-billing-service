import type { PrismaClient } from '@prisma/client';
import { Payment } from '../../../domain/payment/Payment.js';
import { PaymentStatus } from '../../../domain/payment/PaymentStatus.js';
import { type UUID, toUUID } from '../../../shared/types/UUID.js';

export class PaymentGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(payment: Payment): Promise<Payment> {
    const record = await this.prisma.payment.upsert({
      where: { id: payment.id },
      create: {
        id: payment.id,
        quoteId: payment.quoteId,
        serviceOrderId: payment.serviceOrderId,
        amount: payment.amount,
        status: payment.status,
        mercadoPagoId: payment.mercadoPagoId,
        paymentLink: payment.paymentLink,
      },
      update: {
        status: payment.status,
        mercadoPagoId: payment.mercadoPagoId,
        paymentLink: payment.paymentLink,
      },
    });
    return this.toEntity(record);
  }

  async findById(id: UUID): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({ where: { id } });
    return record ? this.toEntity(record) : null;
  }

  async findByServiceOrderId(serviceOrderId: UUID): Promise<Payment | null> {
    const record = await this.prisma.payment.findUnique({ where: { serviceOrderId } });
    return record ? this.toEntity(record) : null;
  }

  async findByMercadoPagoId(mercadoPagoId: string): Promise<Payment | null> {
    const record = await this.prisma.payment.findFirst({ where: { mercadoPagoId } });
    return record ? this.toEntity(record) : null;
  }

  private toEntity(record: {
    id: string;
    quoteId: string;
    serviceOrderId: string;
    amount: number;
    status: string;
    mercadoPagoId: string | null;
    paymentLink: string | null;
    createdAt: Date;
  }): Payment {
    return new Payment({
      id: toUUID(record.id),
      quoteId: toUUID(record.quoteId),
      serviceOrderId: toUUID(record.serviceOrderId),
      amount: record.amount,
      status: record.status as PaymentStatus,
      mercadoPagoId: record.mercadoPagoId ?? undefined,
      paymentLink: record.paymentLink ?? undefined,
      createdAt: record.createdAt,
    });
  }
}
