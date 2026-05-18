import tracer from 'dd-trace';
import { env } from '../config/env.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

type Context = Record<string, unknown>;

function traceContext(): Record<string, string> {
  const span = tracer.scope().active();
  if (!span) return {};
  const ctx = span.context();
  return { 'dd.trace_id': ctx.toTraceId(), 'dd.span_id': ctx.toSpanId() };
}

function emit(level: Level, message: string, context?: Context): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: env.datadog.service,
    env: env.datadog.env,
    message,
    ...traceContext(),
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
