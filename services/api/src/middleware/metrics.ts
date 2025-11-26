import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Create default registry
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// HTTP request counter
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
});

// Payment metrics
const paymentsSuccessTotal = new client.Counter({
  name: 'payments_success_total',
  help: 'Total number of successful payment charges',
});

const paymentsFailedTotal = new client.Counter({
  name: 'payments_failed_total',
  help: 'Total number of failed payment charges',
});

const paymentsRetriesTotal = new client.Counter({
  name: 'payments_retries_total',
  help: 'Total number of payment retry jobs enqueued',
});

const paymentsRetryAttempts = new client.Counter({
  name: 'payments_retry_attempts_total',
  help: 'Total number of payment retry attempts executed',
});

// Ticket metrics
const ticketCreationLatency = new client.Histogram({
  name: 'ticket_creation_latency_seconds',
  help: 'Latency for creating support tickets',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
});

// Socket metrics
const socketConnections = new client.Counter({
  name: 'socket_connections_total',
  help: 'Total socket.io connections established'
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(paymentsSuccessTotal);
register.registerMetric(paymentsFailedTotal);
register.registerMetric(paymentsRetriesTotal);
register.registerMetric(paymentsRetryAttempts);
register.registerMetric(ticketCreationLatency);
register.registerMetric(socketConnections);

export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime();
    res.on('finish', () => {
      const diff = process.hrtime(start);
      const seconds = diff[0] + diff[1] / 1e9;
      const route = (req.route && req.route.path) ? String(req.route.path) : req.path;
      httpRequestsTotal.inc({ method: req.method, route, status: String(res.statusCode) } as any, 1);
      httpRequestDuration.observe({ method: req.method, route, status: String(res.statusCode) } as any, seconds);
    });
    next();
  };
}

export async function metricsEndpoint(_req: Request, res: Response) {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
}

export default { metricsMiddleware, metricsEndpoint };
export {
  register,
  paymentsSuccessTotal,
  paymentsFailedTotal,
  paymentsRetriesTotal,
  paymentsRetryAttempts,
  ticketCreationLatency,
  socketConnections,
};
