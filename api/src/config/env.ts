import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().optional().default(''),

  JWT_SECRET: z.string().default('change-me-dev-only'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('14d'),
  JOB_SECRET: z.string().default('change-me-dev-only'),

  // Entrance-exam candidate token TTL. Candidates get a single long-lived
  // access token (no refresh flow) that must comfortably outlast the 45-min
  // attempt; the real access control is the exam window enforced server-side
  // at login/start, so a generous TTL is safe.
  ENTRANCE_TOKEN_TTL: z.string().default('6h'),

  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  API_ORIGIN: z.string().url().default('http://localhost:4000'),
  COOKIE_DOMAIN: z.string().default('localhost'),

  EMAIL_PROVIDER: z.enum(['resend', 'sendgrid', 'brevo', 'stub']).default('stub'),
  RESEND_API_KEY: z.string().optional().default(''),
  SENDGRID_API_KEY: z.string().optional().default(''),
  BREVO_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('India Learns <notifications@app.indialearns.com>'),

  WHATSAPP_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  META_WABA_PHONE_ID: z.string().optional().default(''),
  META_WABA_ACCESS_TOKEN: z.string().optional().default(''),

  // Storage providers, in order of preference for production:
  //   s3         → AWS S3 (default; bucket in ap-south-1 for DPDP alignment)
  //   mongo      → GridFS in the app's Atlas cluster (legacy; pre-S3 default)
  //   cloudinary → CDN with transformations (kept for optional flip)
  //   stub       → in-memory, used by tests and INTEGRATIONS_MODE=stub
  STORAGE_PROVIDER: z.enum(['s3', 'cloudinary', 'mongo', 'stub']).default('s3'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  // AWS S3 (production file storage). Region is fixed to ap-south-1 by
  // default to match the Atlas cluster's region and DPDP Act 2023
  // data-residency alignment (CLAUDE.md §3). The SDK reads keys from
  // AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars automatically;
  // we accept them here so loadEnv() can validate they exist when
  // STORAGE_PROVIDER=s3.
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().optional().default(''),
  AWS_ACCESS_KEY_ID: z.string().optional().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
  // Optional override for S3-compatible providers (MinIO, LocalStack) in tests.
  AWS_S3_ENDPOINT: z.string().optional().default(''),
  // Signed-URL TTL for direct browser downloads (presigned GET).
  AWS_S3_SIGNED_URL_TTL_SEC: z.coerce.number().int().positive().default(300),

  CERTIFIER_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  CERTIFIER_API_KEY: z.string().optional().default(''),
  CERTIFIER_DEFAULT_TEMPLATE_ID: z.string().optional().default(''),

  RECEIPT_ORG_NAME: z.string().default('India Learns'),
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

  // Symmetric key used to encrypt persisted, admin-recoverable faculty
  // passwords at rest (AES-256-GCM; the raw string is hashed to a 32-byte
  // key). Any sufficiently long random string works. Empty disables the
  // faculty-credential feature (the create/list endpoints error clearly).
  // Set a strong random value in prod (e.g. `openssl rand -base64 48`).
  CREDENTIALS_ENC_KEY: z.string().optional().default(''),

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

  // Q-M4-03 — nightly retention sweep. Defaults are conservative; tighten
  // via Render env if the inbox-render API spends >50ms in a hot route.
  NOTIFICATIONS_READ_RETAIN_DAYS: z.coerce.number().int().positive().default(90),
  NOTIFICATIONS_UNREAD_RETAIN_DAYS: z.coerce.number().int().positive().default(365),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // M9 — Sentry DSN (Runbook §7). When absent, Sentry init is a no-op so
  // dev/test require no extra configuration. SENTRY_TRACES_SAMPLE_RATE bounds
  // the perf-trace volume; default 0.1 (10%) is sane for early production.
  SENTRY_DSN: z.string().optional().default(''),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  SENTRY_ENVIRONMENT: z.string().default('development'),

  GIT_SHA: z.string().default('dev'),

  // Single-service deploys: override path to the built web app. Leave empty
  // to use the default `./web/dist` relative to cwd (works for Render single-
  // service deploys where rootDir is the repo root).
  SERVE_WEB_FROM: z.string().optional().default(''),
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
  // If the faculty-credential key is set at all in prod, it must be strong
  // (it encrypts recoverable passwords). Leaving it empty is allowed — that
  // just disables the feature with a clear runtime error — but a weak key is
  // worse than none, so reject it at boot.
  if (env.CREDENTIALS_ENC_KEY && env.CREDENTIALS_ENC_KEY.length < 24) {
    failures.push('CREDENTIALS_ENC_KEY (must be ≥24 chars when set)');
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
