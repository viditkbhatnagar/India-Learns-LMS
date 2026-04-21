import type { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

const HEADER = 'x-request-id';

declare module 'http' {
  interface IncomingMessage {
    requestId?: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  const id = incoming && incoming.length <= 64 ? incoming : nanoid(12);
  req.requestId = id;
  res.setHeader(HEADER, id);
  next();
}
