import { io, type Socket } from 'socket.io-client';

// M10m — Chat Socket.IO client. Singleton per page so multiple
// components can subscribe to the same connection. Picks the same
// origin the REST client uses (same-origin in production; localhost API
// in dev, see api.ts).

let socket: Socket | null = null;

function originForSocket(): string | undefined {
  const raw = import.meta.env.VITE_API_ORIGIN;
  if (raw && raw.length > 0) return raw;
  // Dev fallback — same value as api.ts uses.
  if (import.meta.env.DEV) return 'http://localhost:4000';
  // Production = same-origin; socket.io-client treats `undefined` as
  // "use window.location.origin".
  return undefined;
}

export function getChatSocket(token: string): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socket = io(originForSocket(), {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  return socket;
}

export function disconnectChatSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
