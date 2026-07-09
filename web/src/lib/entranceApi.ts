import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type {
  EntranceAttemptSelfDto,
  EntranceExamPublicDto,
  EntranceLoginResponse,
  SaveEntranceAnswerInput,
} from 'india-learns-shared-types';
import { useEntranceAuthStore } from '../store/entranceAuth.js';
import { ApiHttpError } from './api.js';

const RAW_ORIGIN = import.meta.env.VITE_API_ORIGIN;
const API_ORIGIN =
  RAW_ORIGIN && RAW_ORIGIN.length > 0
    ? RAW_ORIGIN
    : import.meta.env.DEV
      ? 'http://localhost:4000'
      : '';

interface ApiError {
  error?: { code?: string; message?: string; details?: unknown };
}

// Isolated client for the entrance-candidate surface. Attaches the entrance
// token only, has NO refresh interceptor (candidates have no refresh token),
// and clears the entrance session on 401 so the page can bounce to login.
function makeEntranceClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: `${API_ORIGIN}/v1/entrance`,
    headers: { 'content-type': 'application/json' },
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const { token } = useEntranceAuthStore.getState();
    if (token) config.headers.set?.('authorization', `Bearer ${token}`);
    return config;
  });

  instance.interceptors.response.use(
    (r) => r,
    (err: AxiosError<ApiError>) => {
      const status = err.response?.status ?? 0;
      const body = err.response?.data?.error;
      // Don't nuke the session on a failed login attempt — only on an expired
      // token during the exam.
      const isLogin = err.config?.url?.includes('/login') ?? false;
      if (status === 401 && !isLogin) {
        useEntranceAuthStore.getState().clear();
      }
      throw new ApiHttpError(
        status,
        body?.code ?? 'NETWORK',
        body?.message ?? err.message ?? 'Request failed',
        body?.details,
      );
    },
  );

  return instance;
}

const client = makeEntranceClient();

export interface EntranceState {
  exam: EntranceExamPublicDto;
  attempt: EntranceAttemptSelfDto | null;
  attemptsUsed: number;
  maxAttempts: number;
}

export const entranceApi = {
  async login(phone: string, password: string): Promise<EntranceLoginResponse> {
    const res = await client.post<{ data: EntranceLoginResponse }>('/login', {
      phone,
      password,
    });
    return res.data.data;
  },
  async getState(): Promise<EntranceState> {
    const res = await client.get<{ data: EntranceState }>('/me');
    return res.data.data;
  },
  async startAttempt(): Promise<EntranceAttemptSelfDto> {
    const res = await client.post<{ data: { attempt: EntranceAttemptSelfDto } }>(
      '/me/attempt',
      {},
    );
    return res.data.data.attempt;
  },
  async saveAnswers(answers: SaveEntranceAnswerInput[]): Promise<EntranceAttemptSelfDto> {
    const res = await client.patch<{ data: { attempt: EntranceAttemptSelfDto } }>(
      '/me/attempt',
      { answers },
    );
    return res.data.data.attempt;
  },
  async submit(body: {
    answers?: SaveEntranceAnswerInput[];
    auto?: boolean;
  }): Promise<EntranceAttemptSelfDto> {
    const res = await client.post<{ data: { attempt: EntranceAttemptSelfDto } }>(
      '/me/attempt/submit',
      body,
    );
    return res.data.data.attempt;
  },
};
