import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../outbound/database/connection.js';
import { PaymentGateway } from '../../../outbound/database/PaymentGateway.js';
import { GetPaymentStatusUseCase } from '../../../../application/payment/GetPaymentStatusUseCase.js';
import { PaymentPresenter } from '../presenters/PaymentPresenter.js';
import { toUUID } from '../../../../shared/types/UUID.js';

const router = Router();

router.get('/:serviceOrderId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gateway = new PaymentGateway(prisma);
    const payment = await new GetPaymentStatusUseCase(gateway).execute({
      serviceOrderId: toUUID(req.params['serviceOrderId'] as string),
    });
    res.json(PaymentPresenter.toResponse(payment));
  } catch (err) { next(err); }
});

export default router;
