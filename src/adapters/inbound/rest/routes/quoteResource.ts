import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../outbound/database/connection.js';
import { QuoteGateway } from '../../../outbound/database/QuoteGateway.js';
import { QuoteController } from '../controllers/QuoteController.js';
import { QuotePresenter } from '../presenters/QuotePresenter.js';
import { toUUID } from '../../../../shared/types/UUID.js';
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

router.post('/:id/approve', requireRole(UserRole.ADMIN, UserRole.CLERK), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await controller.approve(toUUID(req.params['id'] as string));
    res.json(QuotePresenter.toResponse(quote));
  } catch (err) { next(err); }
});

router.post('/:id/reject', requireRole(UserRole.ADMIN, UserRole.CLERK), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quote = await controller.reject(toUUID(req.params['id'] as string));
    res.json(QuotePresenter.toResponse(quote));
  } catch (err) { next(err); }
});

export default router;
