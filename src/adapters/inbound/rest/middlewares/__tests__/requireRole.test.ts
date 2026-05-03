import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireRole } from '../requireRole.js';
import { UserRole } from '../../../../../shared/types/UserRole.js';

const makeReq = (role?: string) =>
  ({ headers: { 'x-user-role': role } }) as unknown as Request;

const makeRes = () => {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
};

const next: NextFunction = vi.fn();

describe('requireRole', () => {
  it('should call next when role matches', () => {
    const middleware = requireRole(UserRole.ADMIN);
    middleware(makeReq('ADMIN'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('should call next when one of multiple allowed roles matches', () => {
    const middleware = requireRole(UserRole.ADMIN, UserRole.CLERK);
    middleware(makeReq('CLERK'), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 403 when role does not match', () => {
    const res = makeRes();
    const middleware = requireRole(UserRole.ADMIN);
    middleware(makeReq('MECHANIC'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
  });

  it('should return 403 when x-user-role header is missing', () => {
    const res = makeRes();
    const middleware = requireRole(UserRole.ADMIN);
    middleware(makeReq(undefined), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 403 for unknown role value', () => {
    const res = makeRes();
    const middleware = requireRole(UserRole.ADMIN);
    middleware(makeReq('UNKNOWN_ROLE'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should not call next when access is denied', () => {
    const localNext = vi.fn();
    const middleware = requireRole(UserRole.ADMIN);
    middleware(makeReq('MECHANIC'), makeRes(), localNext);
    expect(localNext).not.toHaveBeenCalled();
  });
});
