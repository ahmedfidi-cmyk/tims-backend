// Payment provider adapters (ADR-0002 / ADR-0007, revised by ADR-0010).
//
// StubPaymentAdapter is the dev/test default (auto-captures, no external calls).
// MoyasarAdapter is a direct-gateway shell that fails closed without credentials;
// completing its real checkout + live HMAC webhook is a credentialed follow-up.
//
// Tabby/Tamara (BNPL) were removed per ADR-0010 — their onboarding/hosted-checkout
// work was cut to ship faster with a single, simpler direct-payment path.

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

interface MoyasarConfig {
  apiKey?: string | undefined;
  webhookSecret?: string | undefined;
}

/**
 * Direct-gateway shell (Moyasar — card + mada, per ADR-0002/ADR-0010). Without
 * credentials every operation fails closed; with them, createIntent should call
 * Moyasar's payment API (left as a credentialed follow-up) and verifyWebhook
 * validates the HMAC signature.
 */
export class MoyasarAdapter implements PaymentAdapter {
  readonly provider = 'moyasar';
  constructor(private readonly cfg: MoyasarConfig = {}) {}
  get configured(): boolean {
    return Boolean(this.cfg.apiKey && this.cfg.webhookSecret);
  }
  async createIntent(_args: CreateIntentArgs): Promise<PaymentIntent> {
    if (!this.configured) throw new PaymentNotConfiguredError(this.provider);
    // Follow-up: POST to Moyasar's payment API and return its redirect/3-D-Secure URL.
    throw new PaymentNotConfiguredError(`${this.provider} (checkout not yet wired)`);
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
