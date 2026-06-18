import { describe, it, expect, beforeEach } from 'vitest';
import {
  NotOrderOwnerError,
  OrderNotPayableError,
  PaymentService,
} from '../src/domains/lahtha/payment/payment.service.js';
import { PaymentNotConfiguredError, type PaymentAdapter } from '../src/domains/lahtha/payment/types.js';
import { StubPaymentAdapter, TabbyAdapter } from '../src/domains/lahtha/payment/adapters.js';
import { InMemoryPaymentRepository, SystemClock } from '../src/domains/lahtha/payment/in-memory-adapters.js';
import { CheckoutServicePaymentPort } from '../src/domains/lahtha/payment/mongo-adapters.js';
import { CheckoutService } from '../src/domains/lahtha/checkout/checkout.service.js';
import {
  FakeInventoryPort,
  InMemoryOrderRepository,
  SystemClock as CheckoutClock,
} from '../src/domains/lahtha/checkout/in-memory-adapters.js';

const silentLogger = { info: () => {}, warn: () => {} };

function harness(adapter: PaymentAdapter = new StubPaymentAdapter()) {
  const inv = new FakeInventoryPort();
  inv.setOwner('dev-1', { ownerId: 'vendor-1', ownerType: 'vendor' });
  const checkout = new CheckoutService({
    orders: new InMemoryOrderRepository(),
    inventory: inv,
    clock: new CheckoutClock(),
    logger: silentLogger,
  });
  const payments = new PaymentService({
    payments: new InMemoryPaymentRepository(),
    checkout: new CheckoutServicePaymentPort(checkout),
    defaultAdapter: adapter,
    adapters: { [adapter.provider]: adapter },
    clock: new SystemClock(),
    logger: silentLogger,
  });
  return { checkout, payments };
}

async function placeOrder(checkout: CheckoutService, fulfillment: 'digital_custody' | 'physical_fulfillment' = 'digital_custody') {
  const { order } = await checkout.placeOrder(
    { deviceId: 'dev-1', fulfillmentType: fulfillment, subtotalHalalat: 100_000 },
    'buyer-1',
  );
  return order;
}

describe('PaymentService', () => {
  let checkout: CheckoutService;
  let payments: PaymentService;
  beforeEach(() => {
    const h = harness();
    checkout = h.checkout;
    payments = h.payments;
  });

  it('stub pay auto-captures and advances the order out of PENDING_PAYMENT', async () => {
    const order = await placeOrder(checkout);
    expect(order.status).toBe('PENDING_PAYMENT');
    const result = await payments.pay(order.orderId, 'buyer-1');
    expect(result.status).toBe('captured');
    expect((await checkout.getOrder(order.orderId)).status).toBe('IN_CUSTODY');
  });

  it('a physical order goes to AWAITING_FULFILLMENT after payment', async () => {
    const order = await placeOrder(checkout, 'physical_fulfillment');
    await payments.pay(order.orderId, 'buyer-1');
    expect((await checkout.getOrder(order.orderId)).status).toBe('AWAITING_FULFILLMENT');
  });

  it('only the buyer may pay', async () => {
    const order = await placeOrder(checkout);
    await expect(payments.pay(order.orderId, 'someone-else')).rejects.toBeInstanceOf(NotOrderOwnerError);
  });

  it('rejects paying a non-pending order', async () => {
    const order = await placeOrder(checkout);
    await payments.pay(order.orderId, 'buyer-1'); // now IN_CUSTODY
    await expect(payments.pay(order.orderId, 'buyer-1')).rejects.toBeInstanceOf(OrderNotPayableError);
  });

  it('rejects paying an unknown order', async () => {
    await expect(payments.pay('nope', 'buyer-1')).rejects.toBeInstanceOf(OrderNotPayableError);
  });
});

describe('PaymentService — webhook (non-auto adapter)', () => {
  const pending: PaymentAdapter = {
    provider: 'pend',
    async createIntent() {
      return { intentId: 'pi_1', autoCaptured: false, redirectUrl: 'https://pay.example/pi_1' };
    },
    async verifyWebhook(_h, raw) {
      const b = JSON.parse(raw || '{}');
      return { intentId: b.intentId, outcome: b.outcome === 'failed' ? 'failed' : 'captured' };
    },
  };

  it('pay returns pending, then a captured webhook advances the order', async () => {
    const h = harness(pending);
    const order = await placeOrder(h.checkout);
    const result = await h.payments.pay(order.orderId, 'buyer-1');
    expect(result.status).toBe('pending');
    expect(result.redirectUrl).toContain('pi_1');
    expect((await h.checkout.getOrder(order.orderId)).status).toBe('PENDING_PAYMENT');

    await h.payments.handleWebhook('pend', {}, JSON.stringify({ intentId: 'pi_1', outcome: 'captured' }));
    expect((await h.checkout.getOrder(order.orderId)).status).toBe('IN_CUSTODY');
  });

  it('a failed webhook moves the order to PAYMENT_FAILED', async () => {
    const h = harness(pending);
    const order = await placeOrder(h.checkout);
    await h.payments.pay(order.orderId, 'buyer-1');
    await h.payments.handleWebhook('pend', {}, JSON.stringify({ intentId: 'pi_1', outcome: 'failed' }));
    expect((await h.checkout.getOrder(order.orderId)).status).toBe('PAYMENT_FAILED');
  });
});

describe('BNPL adapter shells', () => {
  it('Tabby fails closed without credentials', async () => {
    await expect(new TabbyAdapter({}).createIntent({ orderId: 'o', amountHalalat: 1 })).rejects.toBeInstanceOf(
      PaymentNotConfiguredError,
    );
  });
});
