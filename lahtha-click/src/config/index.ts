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
