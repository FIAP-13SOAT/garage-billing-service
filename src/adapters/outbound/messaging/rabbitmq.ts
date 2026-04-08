import amqplib, { type Channel, type ChannelModel } from 'amqplib';
import { env } from '../../../shared/config/env.js';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

export const getRabbitMQChannel = async (): Promise<Channel> => {
  if (channel) return channel;
  connection = await amqplib.connect(env.rabbitmqUrl);
  channel = await connection.createChannel();
  return channel;
};

export const closeRabbitMQ = async (): Promise<void> => {
  await channel?.close();
  await connection?.close();
  channel = null;
  connection = null;
};
