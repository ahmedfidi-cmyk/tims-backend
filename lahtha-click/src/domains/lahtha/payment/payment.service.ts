// Payment service — creates intents and applies webhook results to checkout.

import { randomUUID } from 'node:crypto';
import {
  PaymentNotConfiguredError,
  type AuditLogger,
  type CheckoutPaymentPort,
  type Clock,
  type Payment,
  type PaymentAdapter,
  type PaymentRepository,
} from './types.js';

export class OrderNotPayableError extends Error {
  constructor(public readonly orderId: string, public readonly reason: string) {
    super(`Order ${orderId} is not payable: ${reason}`);
    this.name = 'OrderNotPayableError';
  }
}
export class NotOrderOwnerError extends Error {
  constructor() {
    super('Only the buyer may pay for this order');
    this.name = 'NotOrderOwnerError';
  }
}
export class UnknownProviderError extends Error {
  constructor(public readonly provider: string) {
    super(`Unknown payment provider "${provider}"`);
    this.name = 'UnknownProviderError';
  }
}

export interface PaymentDeps {
  payments: PaymentRepository;
  checkout: CheckoutPaymentPort;
  /** Provider used to create new intents (config-driven). */
  defaultAdapter: PaymentAdapter;
  /** All adapters by provider name (for webhook routing). */
  adapters: Record<string, PaymentAdapter>;
  clock: Clock;
  logger: AuditLogger;
}

export interface PayResult {
  status: 'captured' | 'pending';
  intentId: string;
  redirectUrl?: string;
}

export class PaymentService {
  constructor(private readonly deps: PaymentDeps) {}

  /** Buyer initiates payment for their pending order. */
  async pay(orderId: string, byUserId: string): Promise<PayResult> {
    const order = await this.deps.checkout.getOrder(orderId);
    if (!order) throw new OrderNotPayableError(orderId, 'not found');
    if (order.buyerUserId !== byUserId) throw new NotOrderOwnerError();
    if (order.status !== 'PENDING_PAYMENT') throw new OrderNotPayableError(orderId, `status is ${order.status}`);

    const adapter = this.deps.defaultAdapter;
    const intent = await adapter.createIntent({ orderId, amountHalalat: order.totalHalalat });
    const now = this.deps.clock.now();
    const payment: Payment = {
      paymentId: randomUUID(),
      orderId,
      provider: adapter.provider,
      intentId: intent.intentId,
      amountHalalat: order.totalHalalat,
      status: 'created',
      createdAt: now,
      updatedAt: now,
    };
    await this.deps.payments.create(payment);
    this.deps.logger.info(
      { event: 'PAYMENT_INTENT_CREATED', orderId, provider: adapter.provider, intentId: intent.intentId },
      'payment intent created',
    );

    if (intent.autoCaptured) {
      await this.deps.checkout.applyPaymentResult(orderId, 'captured', intent.intentId);
      await this.deps.payments.setStatus(payment.paymentId, 'captured');
      return { status: 'captured', intentId: intent.intentId };
    }
    return { status: 'pending', intentId: intent.intentId, ...(intent.redirectUrl ? { redirectUrl: intent.redirectUrl } : {}) };
  }

  /** Provider webhook → verify → drive the order's payment result (idempotent). */
  async handleWebhook(provider: string, headers: Record<string, string | undefined>, rawBody: string): Promise<void> {
    const adapter = this.deps.adapters[provider];
    if (!adapter) throw new UnknownProviderError(provider);
    const { intentId, outcome } = await adapter.verifyWebhook(headers, rawBody);

    const payment = await this.deps.payments.findByIntent(intentId);
    if (!payment) {
      this.deps.logger.warn({ event: 'PAYMENT_WEBHOOK_UNKNOWN_INTENT', provider, intentId }, 'webhook for unknown intent');
      return;
    }
    await this.deps.checkout.applyPaymentResult(payment.orderId, outcome, intentId);
    await this.deps.payments.setStatus(payment.paymentId, outcome === 'captured' ? 'captured' : 'failed');
    this.deps.logger.info(
      { event: 'PAYMENT_WEBHOOK_APPLIED', provider, intentId, orderId: payment.orderId, outcome },
      'payment webhook applied',
    );
  }
}

export { PaymentNotConfiguredError };
