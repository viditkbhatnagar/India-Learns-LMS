import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  getOrCreateBatchGroupConversation,
  getOrCreateDirectConversation,
  listMessages,
  listMyConversations,
  markRead,
  searchChatTargets,
  sendMessage,
} from '../services/chatService.js';

// M10e — Internal chat routes (PR-E1). All endpoints require auth.
// Conversations + messages live under /v1/chat/* for clean naming;
// /v1/me/conversations is the natural "give me my list" path.

const CreateDirectBody = z.object({
  otherUserId: z.string().min(1),
});

const BatchGroupBody = z.object({
  batchId: z.string().min(1),
});

const SendMessageBody = z.object({
  body: z.string().max(8000),
  attachments: z
    .array(
      z.object({
        url: z.string().url().max(1024),
        filename: z.string().max(256),
        sizeBytes: z.number().int().min(0),
        mimeType: z.string().max(128),
      }),
    )
    .max(10)
    .optional(),
});

const MessagesQuery = z.object({
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const SearchQuery = z.object({
  q: z.string().min(1).max(120),
});

export function meConversationsRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await listMyConversations(req.auth!.userId);
      res.status(200).json({ data: { items } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function chatRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  // Search users to start a chat with. Used by the "New message" picker.
  router.get(
    '/search-users',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { q } = SearchQuery.parse(req.query);
        const items = await searchChatTargets(req.auth!.userId, q);
        res.status(200).json({ data: { items } });
      } catch (err) {
        next(err);
      }
    },
  );

  // M10m — Get or create the batch-group conversation. Idempotent:
  // every batch has at most one group_batch room. Auto-adds every
  // active student in the batch (and the caller) on first access.
  router.post(
    '/conversations/batch',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { batchId } = BatchGroupBody.parse(req.body);
        const conversation = await getOrCreateBatchGroupConversation(
          batchId,
          req.auth!.userId,
          req.auth!.role,
        );
        res.status(200).json({ data: { conversation } });
      } catch (err) {
        next(err);
      }
    },
  );

  // Create-or-fetch a direct (1:1) conversation. Idempotent — same pair
  // always returns the same conversation id.
  router.post(
    '/conversations/direct',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { otherUserId } = CreateDirectBody.parse(req.body);
        const conversation = await getOrCreateDirectConversation(
          req.auth!.userId,
          otherUserId,
        );
        res.status(200).json({ data: { conversation } });
      } catch (err) {
        next(err);
      }
    },
  );

  // List messages in a conversation. Optional `since` for polling delta.
  router.get(
    '/conversations/:id/messages',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { since, limit } = MessagesQuery.parse(req.query);
        const items = await listMessages(
          req.params.id ?? '',
          req.auth!.userId,
          since ? new Date(since) : null,
          limit,
        );
        res.status(200).json({ data: { items } });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/conversations/:id/messages',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = SendMessageBody.parse(req.body);
        const message = await sendMessage(
          req.params.id ?? '',
          req.auth!.userId,
          body,
        );
        res.status(201).json({ data: { message } });
      } catch (err) {
        next(err);
      }
    },
  );

  // Mark all messages in a conversation as read up to now.
  router.post(
    '/conversations/:id/read',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await markRead(req.params.id ?? '', req.auth!.userId);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
