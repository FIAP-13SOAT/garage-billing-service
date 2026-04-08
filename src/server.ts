import 'dotenv/config';
import './instrument.js';
import app from './app.js';
import { connectDatabase } from './adapters/outbound/database/connection.js';
import { env } from './shared/config/env.js';

const start = async (): Promise<void> => {
  await connectDatabase();

  app.listen(env.port, () => {
    console.log(`garage-billing-service running on port ${env.port}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
