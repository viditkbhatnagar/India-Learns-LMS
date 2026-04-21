import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';

let app: Express | null = null;

export function getApp(): Express {
  if (!app) app = createApp();
  return app;
}

export function agent(): request.SuperAgentTest {
  return request.agent(getApp());
}

export function http(): request.SuperTest<request.Test> {
  return request(getApp());
}
