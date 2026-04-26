import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import healthResource from './adapters/inbound/rest/routes/healthResource.js';
import quoteResource from './adapters/inbound/rest/routes/quoteResource.js';
import paymentResource from './adapters/inbound/rest/routes/paymentResource.js';
import { AppError } from './shared/errors/AppError.js';

const app = express();

app.disable('x-powered-by');
app.use(express.json());

app.use('/health', healthResource);
app.use('/quotes', quoteResource);
app.use('/payments', paymentResource);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
