import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../outbound/database/connection.js';
import { QuoteGateway } from '../../../outbound/database/QuoteGateway.js';
import { QuoteController } from '../controllers/QuoteController.js';
import { QuotePresenter } from '../presenters/QuotePresenter.js';
import { requireRole } from '../middlewares/requireRole.js';
import { UserRole } from '../../../../shared/types/UserRole.js';

const router = Router();
const controller = new QuoteController(new QuoteGateway(prisma));

router.get('/', requireRole(UserRole.ADMIN, UserRole.CLERK), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const quotes = await controller.list();
    res.json(QuotePresenter.toListResponse(quotes));
  } catch (err) { next(err); }
});

export default router;
