import tracer from 'dd-trace';

if (process.env['DD_TRACE_ENABLED'] !== 'false') {
  tracer.init({
    logInjection: true, // injeta trace_id/span_id nos logs estruturados
  });
}

export default tracer;
