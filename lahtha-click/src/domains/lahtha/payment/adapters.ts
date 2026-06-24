// Payment provider adapters (ADR-0002 / ADR-0007).
//
// StubPaymentAdapter is the dev/test default (auto-captures, no external calls).
// Tabby/Tamara/Moyasar are structured shells that fail closed without credentials;
// completing their hosted-checkout + live HMAC webhook is a credentialed follow-up.

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  PaymentNotConfiguredError,
  type CreateIntentArgs,
  type PaymentAdapter,
  type PaymentIntent,
  type WebhookResult,
} from './types.js';

/** Dev/demo: immediately capture. Never enabled in production. */
export class StubPaymentAdapter implements PaymentAdapter {
  readonly provider = 'stub';
  async createIntent(_args: CreateIntentArgs): Promise<PaymentIntent> {
    return { intentId: `stub_${randomUUID()}`, autoCaptured: true };
  }
  async verifyWebhook(_headers: Record<string, string | undefined>, rawBody: string): Promise<WebhookResult> {
    // Allow a manual stub webhook in dev: body { intentId, outcome }.
    const { intentId, outcome } = JSON.parse(rawBody || '{}');
    return { intentId, outcome: outcome === 'failed' ? 'failed' : 'captured' };
  }
}

/** Verify an HMAC-SHA256 signature header (hex) over the raw body, constant-time. */
function verifyHmac(secret: string, rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

interface BnplConfig {
  apiKey?: string | undefined;
  webhookSecret?: string | undefined;
}

/**
 * Shared shell for the BNPL providers. Without credentials every operation fails
 * closed; with them, createIntent should call the provider's hosted-checkout API
 * (left as a credentialed follow-up) and verifyWebhook validates the HMAC.
 */
class BnplAdapter implements PaymentAdapter {
  constructor(readonly provider: string, private readonly cfg: BnplConfig) {}
  get configured(): boolean {
    return Boolean(this.cfg.apiKey && this.cfg.webhookSecret);
  }
  async createIntent(_args: CreateIntentArgs): Promise<PaymentIntent> {
    if (!this.configured) throw new PaymentNotConfiguredError(this.provider);
    // Follow-up: POST to the provider's checkout-session API and return its redirect_url.
    throw new PaymentNotConfiguredError(`${this.provider} (hosted checkout not yet wired)`);
  }
  async verifyWebhook(headers: Record<string, string | undefined>, rawBody: string): Promise<WebhookResult> {
    if (!this.configured) throw new PaymentNotConfiguredError(this.provider);
    if (!verifyHmac(this.cfg.webhookSecret!, rawBody, headers['x-signature'])) {
      throw new PaymentNotConfiguredError(`${this.provider} (bad webhook signature)`);
    }
    const body = JSON.parse(rawBody || '{}');
    return { intentId: body.intentId, outcome: body.status === 'captured' ? 'captured' : 'failed' };
  }
}

export class TabbyAdapter extends BnplAdapter {
  constructor(cfg: BnplConfig) {
    super('tabby', cfg);
  }
}
export class TamaraAdapter extends BnplAdapter {
  constructor(cfg: BnplConfig) {
    super('tamara', cfg);
  }
}
/** Direct gateway placeholder (ADR-0002): present but disabled until credentialed. */
export class MoyasarAdapter implements PaymentAdapter {
  readonly provider = 'moyasar';
  async createIntent(): Promise<PaymentIntent> {
    throw new PaymentNotConfiguredError('moyasar');
  }
  async verifyWebhook(): Promise<WebhookResult> {
    throw new PaymentNotConfiguredError('moyasar');
  }
}
