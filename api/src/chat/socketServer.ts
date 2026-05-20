import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, type ServerOptions, type Socket } from 'socket.io';
import { Types } from 'mongoose';
import { logger } from '../config/logger.js';
import { loadEnv } from '../config/env.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { ConversationMembership } from '../models/index.js';

// M10m — Socket.IO server attached to the same HTTP listener that serves
// Express. Single-process for V1 — Render Standard supports sticky
// sessions; multi-instance scaling would add a Redis adapter, which is a
// follow-up if/when load demands it.
//
// Wire model:
// - Client connects with `Authorization: Bearer <access-token>` either in
//   the handshake `auth` payload (preferred) or in the query string
//   (fallback for environments that strip headers).
// - Server verifies the JWT via the same `verifyAccessToken` used by the
//   HTTP middleware. Invalid → disconnect with an error.
// - Each socket joins a per-user room `user:<userId>` for direct
//   broadcasts (e.g. "you've been added to a group").
// - Per-conversation rooms `conv:<conversationId>` are joined lazily on
//   `chat:join` after the server verifies the caller is a member.

let io: IOServer | null = null;

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    role: string;
  };
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function convRoom(conversationId: string): string {
  return `conv:${conversationId}`;
}

export function initSocketServer(httpServer: HttpServer): void {
  const env = loadEnv();
  // Same-origin in production (single Render service); only the dev flow
  // needs CORS configured. `cors` accepts `undefined` to opt out, not
  // `false` — so we just omit it in prod.
  const ioOpts: Partial<ServerOptions> = { path: '/socket.io' };
  if (env.NODE_ENV !== 'production') {
    ioOpts.cors = { origin: env.WEB_ORIGIN, credentials: true };
  }
  io = new IOServer(httpServer, ioOpts);

  // JWT auth on connect. Tokens come from either `auth.token` (the
  // socket.io-client `auth: { token }` mechanism) or `query.token` as
  // a fallback.
  io.use(async (socket, next) => {
    const tokenFromAuth = (socket.handshake.auth as { token?: string } | undefined)?.token;
    const tokenFromQuery = socket.handshake.query?.token;
    const token =
      (typeof tokenFromAuth === 'string' && tokenFromAuth) ||
      (typeof tokenFromQuery === 'string' && tokenFromQuery) ||
      '';
    if (!token) {
      next(new Error('UNAUTHENTICATED'));
      return;
    }
    try {
      const claims = await verifyAccessToken(token);
      const authed = socket as AuthedSocket;
      authed.data.userId = claims.sub;
      authed.data.role = String(claims.role ?? '');
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (raw) => {
    const socket = raw as AuthedSocket;
    const { userId } = socket.data;
    socket.join(userRoom(userId));
    logger.debug({ userId, socketId: socket.id }, 'chat.socket.connected');

    // Client subscribes to a conversation it has open. We verify
    // membership before adding the socket to the conversation room so a
    // malicious caller can't sniff someone else's messages.
    socket.on('chat:join', async (conversationId: unknown, ack?: (ok: boolean) => void) => {
      if (typeof conversationId !== 'string' || !Types.ObjectId.isValid(conversationId)) {
        ack?.(false);
        return;
      }
      const isMember = await ConversationMembership.exists({
        conversationId: new Types.ObjectId(conversationId),
        userId: new Types.ObjectId(userId),
      });
      if (!isMember) {
        ack?.(false);
        return;
      }
      socket.join(convRoom(conversationId));
      ack?.(true);
    });

    socket.on('chat:leave', (conversationId: unknown) => {
      if (typeof conversationId === 'string') {
        socket.leave(convRoom(conversationId));
      }
    });

    socket.on('disconnect', () => {
      logger.debug({ userId, socketId: socket.id }, 'chat.socket.disconnected');
    });
  });

  logger.info('chat.socket.server.started');
}

// Service-layer hooks call these to push state to connected clients
// without coupling chatService.ts directly to the io instance.

export function emitMessage(
  conversationId: string,
  message: Record<string, unknown>,
): void {
  if (!io) return;
  io.to(convRoom(conversationId)).emit('chat:message', message);
}

export function emitConversationTouched(
  recipientUserIds: string[],
  conversationId: string,
): void {
  if (!io) return;
  // Tell each recipient's other sockets "your conversation list changed"
  // so their sidebar refreshes the unread badge in real time.
  for (const uid of recipientUserIds) {
    io.to(userRoom(uid)).emit('chat:conversation_touched', { conversationId });
  }
}

export function emitMembershipAdded(userId: string, conversationId: string): void {
  if (!io) return;
  io.to(userRoom(userId)).emit('chat:membership_added', { conversationId });
}
