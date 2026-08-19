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
