// Payment entities and ports (ADR-0007). Drives the checkout payment seam.

export type PaymentStatus = 'created' | 'captured' | 'failed';

export interface Payment {
  paymentId: string;
  orderId: string;
  provider: string;
  intentId: string;
  amountHalalat: number;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRepository {
  create(payment: Payment): Promise<Payment>;
  findByIntent(intentId: string): Promise<Payment | null>;
  setStatus(paymentId: string, status: PaymentStatus): Promise<void>;
}

export interface CreateIntentArgs {
  orderId: string;
  amountHalalat: number;
}
export interface PaymentIntent {
  intentId: string;
  redirectUrl?: string;
  /** Stub/dev: capture immediately (no external authorization). */
  autoCaptured: boolean;
}
export interface WebhookResult {
  intentId: string;
  outcome: 'captured' | 'failed';
}

/** A payment provider integration (stub, Tabby, Tamara, Moyasar). */
export interface PaymentAdapter {
  readonly provider: string;
  createIntent(args: CreateIntentArgs): Promise<PaymentIntent>;
  verifyWebhook(headers: Record<string, string | undefined>, rawBody: string): Promise<WebhookResult>;
}

/** Cross-domain port to checkout — read an order and drive its payment result. */
export interface CheckoutPaymentPort {
  getOrder(orderId: string): Promise<{ orderId: string; buyerUserId: string; status: string; totalHalalat: number } | null>;
  applyPaymentResult(orderId: string, outcome: 'captured' | 'failed', paymentRef: string): Promise<void>;
}

export interface Clock {
  now(): Date;
}
export interface AuditLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
}

export class PaymentNotConfiguredError extends Error {
  constructor(public readonly provider: string) {
    super(`Payment provider "${provider}" is not configured`);
    this.name = 'PaymentNotConfiguredError';
  }
}
