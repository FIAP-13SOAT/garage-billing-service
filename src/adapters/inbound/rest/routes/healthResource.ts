import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'garage-billing-service' });
});

router.get('/version', (_req, res) => {
  res.json({ version: '1.0.0', service: 'garage-billing-service' });
});

export default router;
