import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../../../shared/types/UserRole.js';

function roleFromBearer(authHeader: string | undefined): string | undefined {
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  const payload = authHeader.split('.')[1];
  if (!payload) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    return typeof decoded['role'] === 'string' ? decoded['role'] : undefined;
  } catch {
    return undefined;
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.headers['x-user-role'] ?? roleFromBearer(req.headers['authorization']);

    if (!role || typeof role !== 'string' || !roles.includes(role as UserRole)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
}
