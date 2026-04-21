import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll } from 'vitest';

let server: MongoMemoryServer | null = null;

export async function startMongo(): Promise<string> {
  if (!server) {
    server = await MongoMemoryServer.create();
  }
  const uri = server.getUri();
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  return uri;
}

export async function stopMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (server) {
    await server.stop();
    server = null;
  }
}

export async function clearCollections(): Promise<void> {
  const { collections } = mongoose.connection;
  const names = Object.keys(collections);
  await Promise.all(
    names.map((name) => collections[name]!.deleteMany({})),
  );
}

export function useMongo(): void {
  beforeAll(async () => {
    await startMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });
  afterAll(async () => {
    await stopMongo();
  });
}
