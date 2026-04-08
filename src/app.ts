import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import healthResource from './adapters/inbound/rest/routes/healthResource.js';
import { AppError } from './shared/errors/AppError.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json());

app.use('/health', healthResource);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
