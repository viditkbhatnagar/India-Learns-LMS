import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth.js';
import { getDeviceId } from './deviceId.js';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:4000';

interface ApiError {
  error?: { code?: string; message?: string; details?: unknown };
}

export class ApiHttpError extends Error {
  status: number;

  code: string;

  details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function makeClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: `${API_ORIGIN}/v1`,
    headers: { 'content-type': 'application/json' },
    withCredentials: true,
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.set?.('authorization', `Bearer ${token}`);
    }
    return config;
  });

  let refreshing: Promise<string | null> | null = null;

  instance.interceptors.response.use(
    (r) => r,
    async (err: AxiosError<ApiError>) => {
      const status = err.response?.status ?? 0;
      const body = err.response?.data?.error;
      const original = err.config as InternalAxiosRequestConfig & { retried?: boolean };

      // Try a single refresh on 401 UNAUTHENTICATED before logging out.
      const isRefreshCall = original?.url?.includes('/auth/refresh') ?? false;
      if (
        status === 401
        && !original.retried
        && !isRefreshCall
        && useAuthStore.getState().accessToken
      ) {
        original.retried = true;
        if (!refreshing) {
          refreshing = (async () => {
            try {
              const res = await axios.post<{
                data: { accessToken: string };
              }>(
                `${API_ORIGIN}/v1/auth/refresh`,
                { deviceId: getDeviceId() },
                { withCredentials: true },
              );
              const next = res.data?.data?.accessToken ?? null;
              if (next) {
                useAuthStore.getState().setAccessToken(next);
              } else {
                useAuthStore.getState().logout();
              }
              return next;
            } catch {
              useAuthStore.getState().logout();
              return null;
            } finally {
              refreshing = null;
            }
          })();
        }
        const next = await refreshing;
        if (next) {
          original.headers?.set?.('authorization', `Bearer ${next}`);
          return instance(original);
        }
      }

      const message = body?.message ?? err.message ?? 'Request failed';
      throw new ApiHttpError(
        status,
        body?.code ?? 'NETWORK',
        message,
        body?.details,
      );
    },
  );

  return instance;
}

export const api = makeClient();

export function unwrap<T>(res: { data: { data: T } } | { data: T }): T {
  const body = res.data as { data?: T } & T;
  return (body.data ?? body) as T;
}
