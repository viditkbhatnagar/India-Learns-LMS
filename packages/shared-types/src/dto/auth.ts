import type { UserPublicDto } from './user.js';

export interface LoginInput {
  email: string;
  password: string;
  deviceId: string;
}

export interface AcceptInviteInput {
  token: string;
  password: string;
  deviceId: string;
}

export interface PasswordResetRequestInput {
  email: string;
}

export interface PasswordResetConfirmInput {
  token: string;
  password: string;
}

export interface PasswordChangeInput {
  current: string;
  next: string;
}

export interface RefreshInput {
  deviceId: string;
}

export interface AuthTokensResponse {
  user: UserPublicDto;
  accessToken: string;
  accessTokenExpiresIn: number;
}
