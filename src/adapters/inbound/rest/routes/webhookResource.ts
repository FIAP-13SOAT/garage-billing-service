import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../outbound/database/connection.js';
import { PaymentGateway } from '../../../outbound/database/PaymentGateway.js';
import { BillingReplyProducer } from '../../../outbound/messaging/BillingReplyProducer.js';
import { SQSBroker, sqsClient } from '../../../outbound/messaging/SQSBroker.js';
import { HandleWebhookUseCase } from '../../../../application/payment/HandleWebhookUseCase.js';
import { Logger } from '../../../../shared/logger/Logger.js';

const router = Router();
const broker = new SQSBroker(sqsClient);

router.post('/mercadopago', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serviceOrderId = req.query['serviceOrderId'] as string | undefined;

    const topic = req.query['topic'] as string | undefined;

    Logger.info('[Webhook] Mercado Pago notification received', {
      query: req.query,
      body: req.body,
      topic,
      serviceOrderId,
    });

    if (!serviceOrderId) {
      Logger.warn('[Webhook] No serviceOrderId in query params, ignoring');
      res.sendStatus(200);
      return;
    }

    if (topic !== 'payment') {
      Logger.info('[Webhook] Ignoring non-payment notification', { topic });
      res.sendStatus(200);
      return;
    }

    const useCase = new HandleWebhookUseCase(
      new PaymentGateway(prisma),
      new BillingReplyProducer(broker),
    );

    await useCase.execute({ serviceOrderId });
    res.sendStatus(200);
  } catch (err) { next(err); }
});

export default router;
