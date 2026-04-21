import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().optional().default(''),

  JWT_SECRET: z.string().default('change-me-dev-only'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('14d'),
  JOB_SECRET: z.string().default('change-me-dev-only'),

  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  API_ORIGIN: z.string().url().default('http://localhost:4000'),
  COOKIE_DOMAIN: z.string().default('localhost'),

  EMAIL_PROVIDER: z.enum(['resend', 'sendgrid', 'stub']).default('stub'),
  RESEND_API_KEY: z.string().optional().default(''),
  SENDGRID_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('India Learns <notifications@app.indialearns.com>'),

  WHATSAPP_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  META_WABA_PHONE_ID: z.string().optional().default(''),
  META_WABA_ACCESS_TOKEN: z.string().optional().default(''),

  STORAGE_PROVIDER: z.enum(['cloudinary', 'stub']).default('stub'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  CERTIFIER_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  CERTIFIER_API_KEY: z.string().optional().default(''),
  CERTIFIER_DEFAULT_TEMPLATE_ID: z.string().optional().default(''),

  RECEIPT_ORG_NAME: z.string().default('India Learns (LUC)'),
  RECEIPT_ORG_ADDRESS: z.string().default('PENDING'),
  RECEIPT_ORG_GSTIN: z.string().default(''),
  RECEIPT_LOGO_URL: z.string().optional().default(''),

  LOGIN_RATE_MAX: z.coerce.number().int().positive().default(5),
  LOGIN_RATE_WINDOW_MIN: z.coerce.number().int().positive().default(15),
  LOGIN_LOCK_AFTER: z.coerce.number().int().positive().default(10),
  LOGIN_LOCK_DURATION_MIN: z.coerce.number().int().positive().default(30),

  PASSWORD_RESET_RATE_MAX: z.coerce.number().int().positive().default(3),
  PASSWORD_RESET_RATE_WINDOW_MIN: z.coerce.number().int().positive().default(60),

  RATE_LIMITS_DISABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  ARGON2_TIME_COST: z.coerce.number().int().positive().default(3),
  ARGON2_MEMORY_COST: z.coerce.number().int().positive().default(65536),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),

  INVITE_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  RESET_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(30),
  SESSION_CAP: z.coerce.number().int().positive().default(5),

  INTEGRATIONS_MODE: z.enum(['stub', 'live']).default('stub'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  // M8 — api-cost tracking rates (PRD §15). Values are configurable paise per
  // unit; defaults below are sensible India-typical estimates that Logan will
  // reconcile against real invoices (Q-M8-01). Storage is counted per upload.
  EMAIL_UNIT_PAISE: z.coerce.number().int().nonnegative().default(50),
  WHATSAPP_UNIT_PAISE: z.coerce.number().int().nonnegative().default(200),
  STORAGE_UNIT_PAISE: z.coerce.number().int().nonnegative().default(5),
  CERTIFIER_UNIT_PAISE: z.coerce.number().int().nonnegative().default(2500),

  // M8 retry sweep — max attempts and window.
  NOTIFICATIONS_RETRY_MAX: z.coerce.number().int().positive().default(3),
  NOTIFICATIONS_RETRY_WINDOW_HOURS: z.coerce.number().int().positive().default(24),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  GIT_SHA: z.string().default('dev'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

// Defaults committed to `.env.example` — must never be accepted in production.
const REJECTED_SECRETS = new Set(['change-me-dev-only', 'change-me', '']);

function assertProdSecrets(env: Env): void {
  if (env.NODE_ENV !== 'production') return;
  const failures: string[] = [];
  if (REJECTED_SECRETS.has(env.JWT_SECRET) || env.JWT_SECRET.length < 32) {
    failures.push('JWT_SECRET (must be ≥32 chars and not the dev default)');
  }
  if (REJECTED_SECRETS.has(env.JOB_SECRET) || env.JOB_SECRET.length < 32) {
    failures.push('JOB_SECRET (must be ≥32 chars and not the dev default)');
  }
  if (failures.length > 0) {
    console.error('Refusing to start in production with insecure secrets:', failures);
    throw new Error(`Insecure production configuration: ${failures.join(', ')}`);
  }
}

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  assertProdSecrets(parsed.data);
  cached = parsed.data;
  return cached;
}

/**
 * Test-only: drop the memoised env so tests can mutate process.env between cases.
 * Not for production use.
 */
export function resetEnvCache(): void {
  cached = null;
}
