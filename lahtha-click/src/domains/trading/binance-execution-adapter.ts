// Live OrderExecutionPort over Binance's signed Spot and USDT-M Futures REST
// APIs. This is the only file in the trading domain that can move real money
// — every request is HMAC-signed with the configured API secret and every
// entry immediately gets a protective TP/SL attached (OCO on spot,
// reduce-only STOP_MARKET/TAKE_PROFIT_MARKET on futures). See ADR-0012 for
// the safety rails (fail-closed defaults, mainnet confirmation, notional cap)
// that gate whether this adapter is ever constructed.
//
// Not exercised against live Binance endpoints in this environment (no
// outbound network route to Binance here) — smoke-test on testnet before
// relying on it, and re-verify the OCO/futures endpoint paths against
// Binance's current API docs, since exchanges do version these over time.

import { createHmac } from 'node:crypto';
import { MAX_LEVERAGE } from './risk.js';
import {
  ExecutionNotConfiguredError,
  InsufficientBalanceError,
  type ExecutionEnvironment,
  type ExecutionRecord,
  type OpenPositionArgs,
  type OpenPositionResult,
  type OrderExecutionPort,
  type PositionStatusResult,
  type SymbolFilters,
} from './execution-types.js';
import type { TradeDirection } from './types.js';

export interface BinanceExecutionConfig {
  apiKey: string;
  apiSecret: string;
  environment: ExecutionEnvironment;
  spotBaseUrl: string;
  futuresBaseUrl: string;
  requestTimeoutMs: number;
}

function roundDownToStep(value: number, step: number): number {
  if (step <= 0) return value;
  const precision = Math.max(0, Math.round(-Math.log10(step)));
  return Number((Math.floor(value / step) * step).toFixed(precision));
}
function roundToTick(value: number, tick: number): number {
  if (tick <= 0) return value;
  const precision = Math.max(0, Math.round(-Math.log10(tick)));
  return Number((Math.round(value / tick) * tick).toFixed(precision));
}

export class BinanceExecutionAdapter implements OrderExecutionPort {
  readonly environment: ExecutionEnvironment;

  constructor(private readonly cfg: BinanceExecutionConfig) {
    if (!cfg.apiKey || !cfg.apiSecret) {
      throw new ExecutionNotConfiguredError('BINANCE_API_KEY / BINANCE_API_SECRET are not set');
    }
    this.environment = cfg.environment;
  }

  private sign(params: URLSearchParams): URLSearchParams {
    params.set('timestamp', String(Date.now()));
    params.set('recvWindow', '5000');
    const signature = createHmac('sha256', this.cfg.apiSecret).update(params.toString()).digest('hex');
    params.set('signature', signature);
    return params;
  }

  private async signedRequest<T>(baseUrl: string, method: 'GET' | 'POST', path: string, params: URLSearchParams): Promise<T> {
    const signed = this.sign(params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.requestTimeoutMs);
    try {
      const url = method === 'GET' ? `${baseUrl}${path}?${signed.toString()}` : `${baseUrl}${path}`;
      const res = await fetch(url, {
        method,
        headers: { 'X-MBX-APIKEY': this.cfg.apiKey, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: method === 'POST' ? signed.toString() : undefined,
        signal: controller.signal,
      });
      const body = (await res.json()) as unknown;
      if (!res.ok) {
        const msg = typeof body === 'object' && body && 'msg' in body ? String((body as { msg: unknown }).msg) : res.statusText;
        throw new Error(`Binance ${method} ${path} failed: ${res.status} ${msg}`);
      }
      return body as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async publicRequest<T>(baseUrl: string, path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.requestTimeoutMs);
    try {
      const res = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`Binance GET ${path} failed: ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private baseUrl(direction: TradeDirection): string {
    return direction === 'futures_long' ? this.cfg.futuresBaseUrl : this.cfg.spotBaseUrl;
  }

  async getSymbolFilters(symbol: string, direction: TradeDirection): Promise<SymbolFilters> {
    const isFutures = direction === 'futures_long';
    const path = isFutures ? '/fapi/v1/exchangeInfo' : '/api/v3/exchangeInfo';
    const data = await this.publicRequest<{ symbols: Array<{ symbol: string; filters: Array<Record<string, string>> }> }>(
      this.baseUrl(direction),
      path,
    );
    const info = data.symbols.find((s) => s.symbol === symbol);
    if (!info) throw new Error(`Symbol ${symbol} not found in ${isFutures ? 'futures' : 'spot'} exchangeInfo`);

    const lotSize = info.filters.find((f) => f.filterType === 'LOT_SIZE' || f.filterType === 'MARKET_LOT_SIZE');
    const priceFilter = info.filters.find((f) => f.filterType === 'PRICE_FILTER');
    const notionalFilter = info.filters.find((f) => f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL');

    return {
      stepSize: Number(lotSize?.stepSize ?? '0.00000001'),
      tickSize: Number(priceFilter?.tickSize ?? '0.01'),
      minQty: Number(lotSize?.minQty ?? '0'),
      minNotionalUsd: Number(notionalFilter?.minNotional ?? notionalFilter?.notional ?? '10'),
    };
  }

  async getAvailableBalanceUsd(direction: TradeDirection): Promise<number> {
    if (direction === 'futures_long') {
      const account = await this.signedRequest<{ availableBalance: string }>(
        this.cfg.futuresBaseUrl,
        'GET',
        '/fapi/v2/account',
        new URLSearchParams(),
      );
      return Number(account.availableBalance);
    }
    const account = await this.signedRequest<{ balances: Array<{ asset: string; free: string }> }>(
      this.cfg.spotBaseUrl,
      'GET',
      '/api/v3/account',
      new URLSearchParams(),
    );
    return Number(account.balances.find((b) => b.asset === 'USDT')?.free ?? '0');
  }

  async openPosition(args: OpenPositionArgs): Promise<OpenPositionResult> {
    const available = await this.getAvailableBalanceUsd(args.direction);
    if (available < args.notionalUsd) throw new InsufficientBalanceError(available, args.notionalUsd);

    return args.direction === 'futures_long' ? this.openFuturesLong(args) : this.openSpotLong(args);
  }

  private async openSpotLong(args: OpenPositionArgs): Promise<OpenPositionResult> {
    const filters = await this.getSymbolFilters(args.symbol, 'spot_long');

    const entry = await this.signedRequest<{ orderId: number; executedQty: string; cummulativeQuoteQty: string }>(
      this.cfg.spotBaseUrl,
      'POST',
      '/api/v3/order',
      new URLSearchParams({
        symbol: args.symbol,
        side: 'BUY',
        type: 'MARKET',
        quoteOrderQty: args.notionalUsd.toFixed(2),
      }),
    );
    const executedQty = Number(entry.executedQty);
    const executedPrice = executedQty > 0 ? Number(entry.cummulativeQuoteQty) / executedQty : 0;

    const takeProfit = roundToTick(args.takeProfit, filters.tickSize);
    const stopLoss = roundToTick(args.stopLoss, filters.tickSize);
    const stopLimitPrice = roundToTick(args.stopLoss * 0.999, filters.tickSize);

    const oco = await this.signedRequest<{ orderReports: Array<{ orderId: number; type: string }> }>(
      this.cfg.spotBaseUrl,
      'POST',
      '/api/v3/order/oco',
      new URLSearchParams({
        symbol: args.symbol,
        side: 'SELL',
        quantity: entry.executedQty,
        price: takeProfit.toString(),
        stopPrice: stopLoss.toString(),
        stopLimitPrice: stopLimitPrice.toString(),
        stopLimitTimeInForce: 'GTC',
      }),
    );
    const tpLeg = oco.orderReports.find((r) => r.type === 'LIMIT_MAKER' || r.type === 'LIMIT');
    const slLeg = oco.orderReports.find((r) => r.type === 'STOP_LOSS_LIMIT' || r.type === 'STOP_LOSS');

    return {
      entryOrderId: String(entry.orderId),
      executedQty,
      executedPrice,
      takeProfitOrderId: String(tpLeg?.orderId ?? ''),
      stopLossOrderId: String(slLeg?.orderId ?? ''),
    };
  }

  private async openFuturesLong(args: OpenPositionArgs): Promise<OpenPositionResult> {
    await this.signedRequest(
      this.cfg.futuresBaseUrl,
      'POST',
      '/fapi/v1/leverage',
      new URLSearchParams({ symbol: args.symbol, leverage: String(MAX_LEVERAGE) }),
    );

    const filters = await this.getSymbolFilters(args.symbol, 'futures_long');
    const priceData = await this.publicRequest<{ price: string }>(this.cfg.futuresBaseUrl, `/fapi/v1/ticker/price?symbol=${args.symbol}`);
    const markPrice = Number(priceData.price);
    const rawQty = args.notionalUsd / markPrice;
    const qty = roundDownToStep(rawQty, filters.stepSize) || filters.minQty;

    const entry = await this.signedRequest<{ orderId: number; executedQty: string; avgPrice: string }>(
      this.cfg.futuresBaseUrl,
      'POST',
      '/fapi/v1/order',
      new URLSearchParams({ symbol: args.symbol, side: 'BUY', type: 'MARKET', quantity: qty.toString() }),
    );
    const executedQty = Number(entry.executedQty) || qty;
    const executedPrice = Number(entry.avgPrice) || markPrice;

    const takeProfit = roundToTick(args.takeProfit, filters.tickSize);
    const stopLoss = roundToTick(args.stopLoss, filters.tickSize);

    const tp = await this.signedRequest<{ orderId: number }>(
      this.cfg.futuresBaseUrl,
      'POST',
      '/fapi/v1/order',
      new URLSearchParams({
        symbol: args.symbol,
        side: 'SELL',
        type: 'TAKE_PROFIT_MARKET',
        stopPrice: takeProfit.toString(),
        quantity: executedQty.toString(),
        reduceOnly: 'true',
        workingType: 'MARK_PRICE',
      }),
    );
    const sl = await this.signedRequest<{ orderId: number }>(
      this.cfg.futuresBaseUrl,
      'POST',
      '/fapi/v1/order',
      new URLSearchParams({
        symbol: args.symbol,
        side: 'SELL',
        type: 'STOP_MARKET',
        stopPrice: stopLoss.toString(),
        quantity: executedQty.toString(),
        reduceOnly: 'true',
        workingType: 'MARK_PRICE',
      }),
    );

    return {
      entryOrderId: String(entry.orderId),
      executedQty,
      executedPrice,
      takeProfitOrderId: String(tp.orderId),
      stopLossOrderId: String(sl.orderId),
    };
  }

  async checkPositionStatus(execution: ExecutionRecord): Promise<PositionStatusResult> {
    const isFutures = execution.direction === 'futures_long';
    const baseUrl = isFutures ? this.cfg.futuresBaseUrl : this.cfg.spotBaseUrl;
    const orderPath = isFutures ? '/fapi/v1/order' : '/api/v3/order';
    const idParam = isFutures ? 'orderId' : 'orderId';

    const [tp, sl] = await Promise.all([
      execution.takeProfitOrderId
        ? this.signedRequest<{ status: string; avgPrice?: string; price?: string }>(
            baseUrl,
            'GET',
            orderPath,
            new URLSearchParams({ symbol: execution.symbol, [idParam]: execution.takeProfitOrderId }),
          )
        : null,
      execution.stopLossOrderId
        ? this.signedRequest<{ status: string; avgPrice?: string; price?: string }>(
            baseUrl,
            'GET',
            orderPath,
            new URLSearchParams({ symbol: execution.symbol, [idParam]: execution.stopLossOrderId }),
          )
        : null,
    ]);

    if (tp?.status === 'FILLED') {
      return { closed: true, outcome: 'take_profit', exitPrice: Number(tp.avgPrice ?? tp.price ?? 0) };
    }
    if (sl?.status === 'FILLED') {
      return { closed: true, outcome: 'stop_loss', exitPrice: Number(sl.avgPrice ?? sl.price ?? 0) };
    }
    return { closed: false };
  }
}
