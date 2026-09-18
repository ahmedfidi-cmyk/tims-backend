// Live MarketDataPort over Binance's public (unauthenticated) REST endpoints.
// Read-only market data only — no API key, no order placement. Keeping the
// trading agent "semi-automated" means it never holds trading credentials.

import type { FuturesMetrics, Kline, MarketDataPort, OrderBookDepth, Ticker24h } from './types.js';

export interface BinanceMarketDataConfig {
  spotBaseUrl: string;
  futuresBaseUrl: string;
  requestTimeoutMs: number;
}

const DEPTH_BAND_PCT = 0.01; // sum book notional within 1% of the best bid/ask

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Binance request failed: ${res.status} ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface BinanceExchangeInfoSymbol {
  symbol: string;
  status: string;
  quoteAsset: string;
  isSpotTradingAllowed?: boolean;
}
interface BinanceTicker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  bidPrice: string;
  askPrice: string;
}
type BinanceKline = [number, string, string, string, string, string, number, ...unknown[]];
interface BinanceDepth {
  bids: [string, string][];
  asks: [string, string][];
}
interface BinancePremiumIndex {
  symbol: string;
  lastFundingRate: string;
}
interface BinanceOpenInterestHistPoint {
  symbol: string;
  sumOpenInterest: string;
  timestamp: number;
}

export class BinanceMarketDataAdapter implements MarketDataPort {
  constructor(private readonly cfg: BinanceMarketDataConfig) {}

  async listUsdtSymbols(): Promise<string[]> {
    const data = await fetchJson<{ symbols: BinanceExchangeInfoSymbol[] }>(
      `${this.cfg.spotBaseUrl}/api/v3/exchangeInfo`,
      this.cfg.requestTimeoutMs,
    );
    return data.symbols
      .filter((s) => s.quoteAsset === 'USDT' && s.status === 'TRADING' && s.isSpotTradingAllowed !== false)
      .map((s) => s.symbol);
  }

  async ticker24h(symbol: string): Promise<Ticker24h> {
    const t = await fetchJson<BinanceTicker24h>(
      `${this.cfg.spotBaseUrl}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
      this.cfg.requestTimeoutMs,
    );
    return {
      symbol: t.symbol,
      lastPrice: Number(t.lastPrice),
      priceChangePercent: Number(t.priceChangePercent),
      quoteVolume: Number(t.quoteVolume),
      bidPrice: Number(t.bidPrice),
      askPrice: Number(t.askPrice),
    };
  }

  async klines(symbol: string, interval: '1h' | '4h', limit: number): Promise<Kline[]> {
    const raw = await fetchJson<BinanceKline[]>(
      `${this.cfg.spotBaseUrl}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
      this.cfg.requestTimeoutMs,
    );
    return raw.map((k) => ({
      openTime: k[0],
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
      closeTime: k[6],
    }));
  }

  async depth(symbol: string): Promise<OrderBookDepth> {
    const raw = await fetchJson<BinanceDepth>(
      `${this.cfg.spotBaseUrl}/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=100`,
      this.cfg.requestTimeoutMs,
    );
    const bestBid = raw.bids[0] ? Number(raw.bids[0][0]) : 0;
    const bestAsk = raw.asks[0] ? Number(raw.asks[0][0]) : 0;
    const bidDepthUsd = raw.bids
      .filter(([price]) => bestBid > 0 && Number(price) >= bestBid * (1 - DEPTH_BAND_PCT))
      .reduce((sum, [price, qty]) => sum + Number(price) * Number(qty), 0);
    const askDepthUsd = raw.asks
      .filter(([price]) => bestAsk > 0 && Number(price) <= bestAsk * (1 + DEPTH_BAND_PCT))
      .reduce((sum, [price, qty]) => sum + Number(price) * Number(qty), 0);
    return { bidDepthUsd, askDepthUsd };
  }

  async futuresMetrics(symbol: string): Promise<FuturesMetrics | null> {
    try {
      const [premium, oiHist] = await Promise.all([
        fetchJson<BinancePremiumIndex>(
          `${this.cfg.futuresBaseUrl}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`,
          this.cfg.requestTimeoutMs,
        ),
        fetchJson<BinanceOpenInterestHistPoint[]>(
          `${this.cfg.futuresBaseUrl}/futures/data/openInterestHist?symbol=${encodeURIComponent(symbol)}&period=1h&limit=2`,
          this.cfg.requestTimeoutMs,
        ),
      ]);
      const first = oiHist[0];
      const last = oiHist.at(-1);
      const openInterest = last ? Number(last.sumOpenInterest) : 0;
      const openInterestChangePercent =
        first && last && Number(first.sumOpenInterest) > 0
          ? ((Number(last.sumOpenInterest) - Number(first.sumOpenInterest)) / Number(first.sumOpenInterest)) * 100
          : 0;
      return { fundingRate: Number(premium.lastFundingRate), openInterest, openInterestChangePercent };
    } catch {
      return null; // no perpetual contract for this symbol, or futures data unavailable
    }
  }
}
