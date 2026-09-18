// Pure technical-indicator math over kline series. No I/O.

import type { Kline } from './types.js';

export function sma(values: number[], period: number): number {
  const window = values.slice(-period);
  if (window.length === 0) return 0;
  return window.reduce((sum, v) => sum + v, 0) / window.length;
}

export function stdDev(values: number[], period: number): number {
  const window = values.slice(-period);
  if (window.length === 0) return 0;
  const mean = sma(window, window.length);
  const variance = window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / window.length;
  return Math.sqrt(variance);
}

export interface BollingerBands {
  middle: number;
  upper: number;
  lower: number;
  /** Band width as a percentage of the middle band — a Bollinger squeeze reads low. */
  widthPct: number;
}

export function bollingerBands(klines: Kline[], period = 20, multiplier = 2): BollingerBands | null {
  if (klines.length < period) return null;
  const closes = klines.map((k) => k.close);
  const middle = sma(closes, period);
  const dev = stdDev(closes, period);
  const upper = middle + multiplier * dev;
  const lower = middle - multiplier * dev;
  return { middle, upper, lower, widthPct: middle > 0 ? (upper - lower) / middle : 0 };
}

/** Wilder's RSI. Returns null when there isn't enough history. */
export function rsi(klines: Kline[], period = 14): number | null {
  if (klines.length < period + 1) return null;
  const closes = klines.map((k) => k.close);
  let gainSum = 0;
  let lossSum = 0;
  for (let i = closes.length - period; i < closes.length; i += 1) {
    const change = closes[i]! - closes[i - 1]!;
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  const avgGain = gainSum / period;
  const avgLoss = lossSum / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Session VWAP over the supplied kline window (typical-price weighted by volume). */
export function vwap(klines: Kline[]): number | null {
  if (klines.length === 0) return null;
  let notional = 0;
  let volume = 0;
  for (const k of klines) {
    const typical = (k.high + k.low + k.close) / 3;
    notional += typical * k.volume;
    volume += k.volume;
  }
  return volume > 0 ? notional / volume : null;
}
