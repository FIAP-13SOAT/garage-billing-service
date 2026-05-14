import { env } from '../config/env.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

type Context = Record<string, unknown>;

function emit(level: Level, message: string, context?: Context): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: env.datadog.service,
    env: env.datadog.env,
    message,
    ...(context ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const Logger = {
  debug(message: string, context?: Context): void {
    emit('debug', message, context);
  },
  info(message: string, context?: Context): void {
    emit('info', message, context);
  },
  warn(message: string, context?: Context): void {
    emit('warn', message, context);
  },
  error(message: string, context?: Context): void {
    emit('error', message, context);
  },
};
