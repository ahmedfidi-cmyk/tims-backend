// Public entry point for the payment domain (ADR-0007).

import { Router } from 'express';
import { loadConfig } from '../../../config/index.js';
import { logger } from '../../../lib/logger.js';
import { PaymentService } from './payment.service.js';
import { createPaymentRouter } from './payment.routes.js';
import { SystemClock, InMemoryPaymentRepository } from './in-memory-adapters.js';
import { CheckoutServicePaymentPort, MongoPaymentRepository } from './mongo-adapters.js';
import { MoyasarAdapter, StubPaymentAdapter, TabbyAdapter, TamaraAdapter } from './adapters.js';
import type { PaymentAdapter } from './types.js';
import type { CheckoutService } from '../checkout/checkout.service.js';
import type { Authz } from '../../iam/authz.js';

export { PaymentService } from './payment.service.js';
export { createPaymentRouter } from './payment.routes.js';
export type * from './types.js';

function buildAdapters() {
  const cfg = loadConfig();
  const adapters: Record<string, PaymentAdapter> = {
    stub: new StubPaymentAdapter(),
    tabby: new TabbyAdapter({ apiKey: cfg.TABBY_API_KEY, webhookSecret: cfg.TABBY_WEBHOOK_SECRET }),
    tamara: new TamaraAdapter({ apiKey: cfg.TAMARA_API_KEY, webhookSecret: cfg.TAMARA_WEBHOOK_SECRET }),
    moyasar: new MoyasarAdapter(),
  };
  // Default to the stub outside production unless a provider is explicitly chosen.
  const chosen = cfg.PAYMENT_PROVIDER ?? (cfg.NODE_ENV === 'production' ? 'tabby' : 'stub');
  const defaultAdapter = adapters[chosen] ?? adapters.stub!;
  return { adapters, defaultAdapter };
}

/** Build the production payment service over the checkout service. */
export function createPaymentService(checkout: CheckoutService): PaymentService {
  const { adapters, defaultAdapter } = buildAdapters();
  return new PaymentService({
    payments: new MongoPaymentRepository(),
    checkout: new CheckoutServicePaymentPort(checkout),
    defaultAdapter,
    adapters,
    clock: new SystemClock(),
    logger,
  });
}

/** Build an in-memory payment service (tests). */
export function createInMemoryPaymentService(checkout: import('./types.js').CheckoutPaymentPort): PaymentService {
  const { adapters, defaultAdapter } = buildAdapters();
  return new PaymentService({
    payments: new InMemoryPaymentRepository(),
    checkout,
    defaultAdapter,
    adapters,
    clock: new SystemClock(),
    logger,
  });
}

export function createLahthaPaymentRouter(service: PaymentService, authz: Authz): Router {
  return createPaymentRouter(service, authz);
}
