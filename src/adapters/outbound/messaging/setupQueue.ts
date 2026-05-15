import type { Channel } from 'amqplib';

const DLX = 'dlx';

export async function setupQueue(channel: Channel, queue: string): Promise<void> {
  const dlq = `${queue}.dead`;
  await channel.assertExchange(DLX, 'direct', { durable: true });
  await channel.assertQueue(dlq, { durable: true });
  await channel.bindQueue(dlq, DLX, queue);
  await channel.assertQueue(queue, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': DLX, 'x-dead-letter-routing-key': queue },
  });
}
