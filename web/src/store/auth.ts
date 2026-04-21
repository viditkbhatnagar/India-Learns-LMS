import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPublicDto } from 'india-learns-shared-types';

interface AuthState {
  user: UserPublicDto | null;
  accessToken: string | null;
  setSession: (user: UserPublicDto, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setSession: (user, accessToken) => set({ user, accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () => set({ user: null, accessToken: null }),
    }),
    { name: 'il-auth' },
  ),
);
