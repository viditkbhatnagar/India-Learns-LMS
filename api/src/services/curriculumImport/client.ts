import { z } from 'zod';
import { HttpError } from '../../middleware/error.js';
import { WorkflowEnvelopeSchema, type Workflow } from './schema.js';

// Generator API client. The generator is a separate service we deployed at
// curriculum-api-bsac.onrender.com. Read endpoints (GET /api/v3/workflow/:id
// and friends) are unauthenticated by design — they're read-only and the LMS
// only uses them as the curriculum source. Render free tier sleeps after
// ~15 min idle so the first request can take ~30s; we retry once on 502/504.

const DEFAULT_BASE_URL = 'https://curriculum-api-bsac.onrender.com';
const COLD_START_RETRY_STATUSES = new Set([502, 503, 504]);
const COLD_START_RETRY_DELAY_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;

function getBaseUrl(): string {
  return process.env.CURRICULUM_GENERATOR_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

interface FetchOpts {
  retryOnColdStart?: boolean;
  signal?: AbortSignal;
}

async function generatorFetch(
  path: string,
  opts: FetchOpts = { retryOnColdStart: true },
): Promise<unknown> {
  const url = `${getBaseUrl()}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: opts.signal ?? controller.signal,
      });
    } catch (err) {
      throw new HttpError(
        502,
        'GENERATOR_UNREACHABLE',
        `Could not reach the curriculum generator at ${getBaseUrl()}: ${(err as Error).message}`,
      );
    }
    if (!res.ok) {
      if (
        opts.retryOnColdStart
        && COLD_START_RETRY_STATUSES.has(res.status)
      ) {
        // Likely Render cold-start. Wait once then retry without further
        // recursion.
        await new Promise<void>((r) => {
          setTimeout(r, COLD_START_RETRY_DELAY_MS);
        });
        return generatorFetch(path, { retryOnColdStart: false, signal: opts.signal });
      }
      const text = await res.text().catch(() => '');
      throw new HttpError(
        res.status,
        'GENERATOR_HTTP_ERROR',
        `Generator returned ${res.status}: ${text.slice(0, 500) || res.statusText}`,
      );
    }
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkGeneratorHealth(): Promise<{ ok: boolean; baseUrl: string }> {
  try {
    const body = await generatorFetch('/health', { retryOnColdStart: true });
    // Generator reports `status: "healthy"`; older versions used `"ok"`.
    const status = (body as { status?: string } | null)?.status;
    const ok = status === 'healthy' || status === 'ok';
    return { ok, baseUrl: getBaseUrl() };
  } catch {
    return { ok: false, baseUrl: getBaseUrl() };
  }
}

const WorkflowIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Workflow id must be a 24-hex Mongo ObjectId.');

export async function fetchWorkflow(workflowId: string): Promise<Workflow> {
  const id = WorkflowIdSchema.parse(workflowId.trim());
  const raw = await generatorFetch(`/api/v3/workflow/${id}`);
  const parsed = WorkflowEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(
      502,
      'GENERATOR_PAYLOAD_INVALID',
      `Generator response failed schema validation: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    );
  }
  return parsed.data.data;
}
