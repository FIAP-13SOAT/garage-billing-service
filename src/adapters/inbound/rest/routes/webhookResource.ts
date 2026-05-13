import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../outbound/database/connection.js';
import { PaymentGateway } from '../../../outbound/database/PaymentGateway.js';
import { BillingReplyProducer } from '../../../outbound/messaging/BillingReplyProducer.js';
import { getRabbitMQChannel } from '../../../outbound/messaging/rabbitmq.js';
import { HandleWebhookUseCase } from '../../../../application/payment/HandleWebhookUseCase.js';

const router = Router();

type MpWebhookBody = {
  action?: string;
  data?: { id?: string | number };
};

router.post('/mercadopago', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as MpWebhookBody;
    const mpId = body?.data?.id ? String(body.data.id) : null;

    if (!mpId) {
      res.sendStatus(200);
      return;
    }

    const channel = await getRabbitMQChannel();
    const useCase = new HandleWebhookUseCase(
      new PaymentGateway(prisma),
      new BillingReplyProducer(channel),
    );

    await useCase.execute({ mercadoPagoId: mpId });
    res.sendStatus(200);
  } catch (err) { next(err); }
});

export default router;
