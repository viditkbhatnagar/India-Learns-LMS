import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { EntranceCandidatePublicDto } from 'india-learns-shared-types';

// Deliberately separate from `useAuthStore`: entrance candidates are not Users
// and must never share the main app's token, refresh flow, or persisted store.
// Backed by sessionStorage so the token survives a mid-exam refresh but is gone
// once the tab closes — fitting for a temporary, one-shot login.
interface EntranceAuthState {
  candidate: EntranceCandidatePublicDto | null;
  token: string | null;
  setSession: (candidate: EntranceCandidatePublicDto, token: string) => void;
  clear: () => void;
}

export const useEntranceAuthStore = create<EntranceAuthState>()(
  persist(
    (set) => ({
      candidate: null,
      token: null,
      setSession: (candidate, token) => set({ candidate, token }),
      clear: () => set({ candidate: null, token: null }),
    }),
    { name: 'il-entrance', storage: createJSONStorage(() => sessionStorage) },
  ),
);
