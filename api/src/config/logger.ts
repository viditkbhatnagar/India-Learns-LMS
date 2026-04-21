import pino from 'pino';
import { loadEnv } from './env.js';

const env = loadEnv();

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { svc: 'il-api', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
});
