import { useEffect, useState } from 'react';
import { Button } from './ui/Button.js';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'il-install-dismissed';

/**
 * Mobile-only install prompt — captures the `beforeinstallprompt` event and
 * surfaces a small bottom banner. Dismissed state is persisted so the banner
 * doesn't pester the user across sessions.
 */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  });

  useEffect(() => {
    if (dismissed) return;
    function onPrompt(e: Event) {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [dismissed]);

  if (!evt || dismissed) return null;

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
    setEvt(null);
  }

  async function install() {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === 'accepted') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    setEvt(null);
    setDismissed(true);
  }

  return (
    <div
      className="fixed bottom-3 inset-x-3 z-40 sm:hidden bg-brand-navy text-white rounded-xl shadow-lg p-3 flex items-center gap-3"
      role="region"
      aria-label="Install India Learns"
    >
      <div className="flex-1 leading-tight">
        <p className="text-sm font-semibold">Install India Learns</p>
        <p className="text-xs text-white/70">Faster access, works offline.</p>
      </div>
      <Button size="sm" onClick={install}>
        Install
      </Button>
      <button
        type="button"
        onClick={dismiss}
        className="text-white/70 hover:text-white text-xs px-2 py-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Listens for the `sw:update-ready` event dispatched by `registerServiceWorker`
 * and surfaces a refresh banner.
 */
export function ServiceWorkerUpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function onReady() {
      setReady(true);
    }
    window.addEventListener('sw:update-ready', onReady);
    return () => window.removeEventListener('sw:update-ready', onReady);
  }, []);

  if (!ready) return null;

  return (
    <div
      className="fixed top-3 inset-x-3 z-50 bg-brand-orange text-brand-navy rounded-xl shadow-lg p-3 flex items-center gap-3"
      role="alert"
    >
      <p className="flex-1 text-sm font-medium">A new version is ready.</p>
      <Button size="sm" variant="secondary" onClick={() => location.reload()}>
        Refresh
      </Button>
    </div>
  );
}
