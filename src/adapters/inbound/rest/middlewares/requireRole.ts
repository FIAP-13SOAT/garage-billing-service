import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../../../shared/types/UserRole.js';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.headers['x-user-role'];

    if (!role || typeof role !== 'string' || !roles.includes(role as UserRole)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
}
