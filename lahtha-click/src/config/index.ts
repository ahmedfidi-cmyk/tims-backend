import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().min(1),
  MONGO_DB_NAME: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SERVICE_NAME: z.string().default('lahtha-click'),

  // IAM (identity + sessions). The OTP pepper keys the HMAC of one-time codes;
  // it MUST be overridden with a secret outside local development.
  IAM_OTP_PEPPER: z.string().min(1).default('dev-otp-pepper-change-me'),

  // Microsoft Entra ID (MFA step-up). When unset, MFA fails closed.
  ENTRA_TENANT_ID: z.string().optional(),
  ENTRA_CLIENT_ID: z.string().optional(),
  ENTRA_ISSUER: z.string().optional(),

  // Payments (ADR-0007, revised by ADR-0010: BNPL dropped for a single direct
  // gateway). Default provider is the dev stub outside production.
  PAYMENT_PROVIDER: z.enum(['stub', 'moyasar']).optional(),
  MOYASAR_API_KEY: z.string().optional(),
  MOYASAR_WEBHOOK_SECRET: z.string().optional(),

  // Object storage for device documents (ADR-0008). Outside production the dev
  // stub is used unless S3 is configured; in production a stub is refused (the
  // storage seam fails closed). S3_ENDPOINT switches to path-style addressing.
  STORAGE_DRIVER: z.enum(['stub', 's3']).optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_UPLOAD_EXPIRES_SECONDS: z.coerce.number().int().positive().max(3600).optional(),

  // Trading domain — daily Binance signal generator (ADR-0011). These market-data
  // endpoints are always mainnet (public, read-only) regardless of execution env.
  BINANCE_SPOT_BASE_URL: z.string().url().default('https://api.binance.com'),
  BINANCE_FUTURES_BASE_URL: z.string().url().default('https://fapi.binance.com'),
  BINANCE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  TRADING_STARTING_EQUITY_USD_CENTS: z.coerce.number().int().positive().default(500_000), // $5,000
  TRADING_TARGET_EQUITY_USD_CENTS: z.coerce.number().int().positive().default(5_000_000), // $50,000
  TRADING_CANDIDATE_POOL_SIZE: z.coerce.number().int().positive().max(100).default(30),

  // Live execution (ADR-0012) — OFF by default (fails closed). Turning this on
  // lets the trading domain place real orders with real money. BINANCE_API_KEY
  // must be a trading-only key (withdrawals disabled on the Binance side).
  BINANCE_EXECUTION_ENABLED: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  BINANCE_TRADING_ENV: z.enum(['testnet', 'mainnet']).default('testnet'),
  BINANCE_API_KEY: z.string().optional(),
  BINANCE_API_SECRET: z.string().optional(),
  BINANCE_SPOT_TESTNET_BASE_URL: z.string().url().default('https://testnet.binance.vision'),
  BINANCE_FUTURES_TESTNET_BASE_URL: z.string().url().default('https://testnet.binancefuture.com'),
  // Extra guard against flipping to mainnet by accident: must be this exact
  // string, set deliberately, for a mainnet execution config to be accepted.
  BINANCE_MAINNET_CONFIRM: z.string().optional(),
  // Hard per-trade cap in USD, independent of the Kelly-sized allocationPct —
  // a second, simpler ceiling that doesn't depend on the risk math being right.
  MAX_TRADE_NOTIONAL_USD: z.coerce.number().positive().default(250),
}).superRefine((cfg, ctx) => {
  if (cfg.BINANCE_EXECUTION_ENABLED) {
    if (!cfg.BINANCE_API_KEY || !cfg.BINANCE_API_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['BINANCE_API_KEY'], message: 'BINANCE_API_KEY and BINANCE_API_SECRET are required when BINANCE_EXECUTION_ENABLED=true' });
    }
    if (cfg.BINANCE_TRADING_ENV === 'mainnet' && cfg.BINANCE_MAINNET_CONFIRM !== 'I_UNDERSTAND_THE_RISK') {
      ctx.addIssue({
        code: 'custom',
        path: ['BINANCE_MAINNET_CONFIRM'],
        message: 'set BINANCE_MAINNET_CONFIRM=I_UNDERSTAND_THE_RISK to enable live execution against mainnet (real money)',
      });
    }
  }
});

export type Config = z.infer<typeof ConfigSchema>;

let cachedConfig: Config | null = null;

export function loadConfig(): Config {
  if (cachedConfig) return cachedConfig;
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cachedConfig = parsed.data;
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
