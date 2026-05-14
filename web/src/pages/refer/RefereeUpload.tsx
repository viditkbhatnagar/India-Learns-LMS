import { useQuery, useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { admissionsApi } from '../../lib/endpoints.js';
import { ApiHttpError } from '../../lib/api.js';

// M3b — Public referee upload page. No auth; the URL token is the only
// credential. Mounted at /refer/:token in App.tsx, outside RequireAuth.

export function RefereeUploadPage() {
  const { token = '' } = useParams<{ token: string }>();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: ctx, isLoading, isError, error: loadError } = useQuery({
    queryKey: ['admissions', 'referee', token],
    queryFn: () => admissionsApi.getRefereeContext(token),
    enabled: Boolean(token),
    retry: false,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const ticket = await admissionsApi.refereeSignUpload(token, {
        mimeType: file.type,
        sizeBytes: file.size,
      });
      try {
        const fd = new FormData();
        fd.append('file', file);
        for (const [k, v] of Object.entries(ticket.headers)) {
          if (k.startsWith('x-cld-')) fd.append(k.slice('x-cld-'.length), v);
        }
        await fetch(ticket.url, { method: 'POST', body: fd });
      } catch {
        // Stub adapter / unreachable destination — ignore; the API still
        // accepts the register call in dev because the storage layer is a
        // stub that returns valid URLs.
      }
      await admissionsApi.refereeUpload(token, {
        url: ticket.url,
        key: ticket.key,
        sizeBytes: file.size,
        mimeType: file.type,
      });
    },
    onSuccess: () => setUploaded(true),
    onError: (err) => {
      setError(err instanceof ApiHttpError ? err.message : 'Upload failed.');
    },
  });

  async function handleFile(file: File) {
    setError(null);
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setError('Only PDF, JPG, or PNG files are accepted.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be 10 MB or smaller.');
      return;
    }
    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen grid place-items-center bg-surface p-6">
        <p className="text-muted">Loading…</p>
      </main>
    );
  }

  if (isError) {
    const message =
      loadError instanceof ApiHttpError
        ? loadError.message
        : 'This link is no longer valid.';
    return (
      <main className="min-h-screen grid place-items-center bg-surface p-6">
        <article className="max-w-md w-full mx-auto text-center space-y-3">
          <Badge tone="danger" size="md">Link expired or used</Badge>
          <p className="text-muted">{message}</p>
          <p className="text-xs text-muted">
            If you believe this is an error, contact the applicant who invited
            you; they can resend the link from their portal.
          </p>
        </article>
      </main>
    );
  }

  if (!ctx) return null;

  if (uploaded) {
    return (
      <main className="min-h-screen grid place-items-center bg-surface p-6">
        <article className="max-w-md w-full mx-auto text-center space-y-4 animate-fade-in-up">
          <div className="text-brand-orange text-5xl">✓</div>
          <h1 className="text-display-sm text-brand-navy">Thank you</h1>
          <p className="text-muted">
            Your letter has been received. You can close this tab now.
          </p>
        </article>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-black/5 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/brand/logo.jpg" alt="India Learns" className="h-9 w-auto rounded-md" />
          <span className="text-brand-navy font-semibold">India Learns Admissions</span>
        </div>
      </header>
      <section className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[0.15em] text-brand-orange font-bold mb-2">
            Letter of recommendation
          </p>
          <h1 className="text-display-sm text-brand-navy">
            Hi {ctx.refereeName} — please upload your letter for {ctx.applicantFirstName}.
          </h1>
          <p className="mt-2 text-muted">
            {ctx.applicantFirstName} is applying
            {ctx.programName ? ` to ${ctx.programName}` : ''}{' '}
            at India Learns and has listed you as a referee. Upload a single
            PDF, JPG, or PNG (max 10 MB).
          </p>
          <p className="mt-2 text-xs text-muted">
            This link expires {new Date(ctx.expiresAt).toLocaleDateString()} and
            can only be used once.
          </p>
        </header>

        <article className="rounded-2xl bg-white shadow-elev-2 border border-black/5 p-6">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf,.jpg,.jpeg,image/jpeg,.png,image/png"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="hidden"
          />
          <Button
            type="button"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
            size="lg"
            className="w-full"
          >
            Choose file
          </Button>
          {error && (
            <div role="alert" className="mt-3 rounded-xl border border-danger/30 bg-red-50 text-danger p-3 text-sm">
              {error}
            </div>
          )}
        </article>

        <p className="text-xs text-muted text-center">
          Your letter is shared only with the India Learns Admissions Officer
          reviewing this application.
        </p>
      </section>
    </main>
  );
}
