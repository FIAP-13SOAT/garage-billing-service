import tracer from 'dd-trace';

if (process.env['DD_TRACE_ENABLED'] !== 'false') {
  tracer.init({
    logInjection: true,
    service: process.env['DD_SERVICE'],
    env: process.env['DD_ENV'],
    version: process.env['DD_VERSION'],
  });
}

export default tracer;
