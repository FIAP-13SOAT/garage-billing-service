import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Logger } from '../../../shared/logger/Logger.js';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
export const prisma = new PrismaClient({ adapter });

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect();
  Logger.info('Database connected');
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
};
