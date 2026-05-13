import tracer from 'dd-trace';
import { env } from '../config/env.js';

type Tags = Record<string, string | number>;

const BASE_TAGS: Tags = {
  service: env.datadog.service,
  env: env.datadog.env,
};

function tag(extra?: Tags): string[] {
  const merged = { ...BASE_TAGS, ...extra };
  return Object.entries(merged).map(([k, v]) => `${k}:${v}`);
}

export const MetricsService = {
  increment(metric: string, extra?: Tags): void {
    tracer.dogstatsd.increment(metric, 1, tag(extra));
  },

  gauge(metric: string, value: number, extra?: Tags): void {
    tracer.dogstatsd.gauge(metric, value, tag(extra));
  },

  histogram(metric: string, value: number, extra?: Tags): void {
    tracer.dogstatsd.histogram(metric, value, tag(extra));
  },

  distribution(metric: string, value: number, extra?: Tags): void {
    tracer.dogstatsd.distribution(metric, value, tag(extra));
  },
};
