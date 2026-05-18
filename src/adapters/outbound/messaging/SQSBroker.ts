import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { env } from '../../../shared/config/env.js';
import { Logger } from '../../../shared/logger/Logger.js';

interface SagaMessage {
  type: string;
  payload: unknown;
}

const clientConfig = env.sqsEndpoint
  ? { region: env.awsRegion, endpoint: env.sqsEndpoint, credentials: { accessKeyId: 'local', secretAccessKey: 'local' } }
  : { region: env.awsRegion };

export const sqsClient = new SQSClient(clientConfig);

export class SQSBroker {
  private readonly stops: Array<() => void> = [];

  constructor(private readonly client: SQSClient) {}

  async publish<T>(queueUrl: string, type: string, payload: T): Promise<void> {
    const message: SagaMessage = { type, payload };
    await this.client.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
    }));
  }

  subscribe(queueUrl: string, handler: (type: string, payload: unknown) => Promise<void>): void {
    let running = true;
    this.stops.push(() => { running = false; });

    const poll = async (): Promise<void> => {
      while (running) {
        try {
          const result = await this.client.send(new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            WaitTimeSeconds: 20,
            MaxNumberOfMessages: 10,
          }));
          for (const msg of result.Messages ?? []) {
            try {
              const { type, payload } = JSON.parse(msg.Body!) as SagaMessage;
              await handler(type, payload);
              await this.client.send(new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: msg.ReceiptHandle!,
              }));
            } catch (err) {
              Logger.error('[SQSBroker] message processing failed', { err });
            }
          }
        } catch (err) {
          if (running) {
            Logger.error('[SQSBroker] polling error', { err });
            await new Promise<void>((r) => setTimeout(r, 1000));
          }
        }
      }
    };

    void poll();
  }

  stop(): void {
    for (const fn of this.stops) fn();
    this.stops.length = 0;
  }
}
