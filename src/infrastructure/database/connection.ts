import { PrismaClient } from '@prisma/client';

// PrismaClient reads DATABASE_URL from environment automatically
export const prisma = new PrismaClient();

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect();
  console.debug('Database connected');
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
};
