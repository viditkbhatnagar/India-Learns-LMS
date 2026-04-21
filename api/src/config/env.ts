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

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  GIT_SHA: z.string().default('dev'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  cached = parsed.data;
  return cached;
}
