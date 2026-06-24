// HTTP controllers for payments. `pay` needs a buyer session; the webhook is public.

import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  NotOrderOwnerError,
  OrderNotPayableError,
  PaymentService,
  UnknownProviderError,
} from './payment.service.js';
import { PaymentNotConfiguredError } from './types.js';
import type { Authz } from '../../iam/authz.js';

function param(req: Request, name: string): string {
  return req.params[name] ?? '';
}
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch((err: unknown) => mapError(err, req, res, next));
  };
}
function mapError(err: unknown, req: Request, res: Response, next: NextFunction): void {
  const correlationId = req.correlationId;
  if (err instanceof OrderNotPayableError) return void res.status(409).json({ error: 'order_not_payable', reason: err.reason, correlationId });
  if (err instanceof NotOrderOwnerError) return void res.status(403).json({ error: 'forbidden', correlationId });
  if (err instanceof UnknownProviderError) return void res.status(404).json({ error: 'unknown_provider', provider: err.provider, correlationId });
  if (err instanceof PaymentNotConfiguredError) return void res.status(503).json({ error: 'payment_not_configured', correlationId });
  next(err);
}

export function createPaymentRouter(service: PaymentService, authz: Authz): Router {
  const router = Router();

  // Buyer pays for their pending order.
  router.post(
    '/orders/:orderId/pay',
    authz.requirePermission('lahtha.order.place'),
    asyncHandler(async (req, res) => {
      const result = await service.pay(param(req, 'orderId'), req.principalUserId!);
      res.json(result);
    }),
  );

  // Provider webhook (public; verified per-adapter). Raw body re-serialized from
  // the parsed JSON — sufficient for the stub; real providers need raw-body bytes.
  router.post(
    '/payments/webhook/:provider',
    asyncHandler(async (req, res) => {
      const headers = req.headers as Record<string, string | undefined>;
      await service.handleWebhook(param(req, 'provider'), headers, JSON.stringify(req.body ?? {}));
      res.json({ ok: true });
    }),
  );

  return router;
}
