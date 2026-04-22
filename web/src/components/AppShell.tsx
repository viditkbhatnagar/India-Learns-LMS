import { useEffect, useState, type PropsWithChildren } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import FocusTrap from 'focus-trap-react';
import type { Role } from 'india-learns-shared-types';
import { useAuthStore } from '../store/auth.js';
import { authApi } from '../lib/endpoints.js';
import { NotificationBell } from './NotificationBell.js';
import { Badge } from './ui/Badge.js';
import { InstallPrompt, ServiceWorkerUpdateBanner } from './InstallPrompt.js';
import { MobileBottomTabs } from './mobile/BottomTabs.js';

interface NavEntry {
  label: string;
  to: string;
  icon?: string;
}

const NAV_BY_ROLE: Record<Role, NavEntry[]> = {
  student: [
    { label: 'Dashboard', to: '/student/dashboard' },
    { label: 'Courses', to: '/student/courses' },
    { label: 'Timetable', to: '/student/timetable' },
    { label: 'Fees', to: '/student/fees' },
    { label: 'Tickets', to: '/student/tickets' },
    { label: 'Feedback', to: '/student/feedback' },
    { label: 'Certificates', to: '/student/certificates' },
  ],
  faculty: [
    { label: 'Dashboard', to: '/faculty/dashboard' },
    { label: 'Courses', to: '/faculty/courses' },
    { label: 'Grading', to: '/faculty/grading' },
    { label: 'Feedback', to: '/faculty/feedback' },
    { label: 'Timetable', to: '/faculty/timetable' },
  ],
  finance: [
    { label: 'Dashboard', to: '/finance/dashboard' },
    { label: 'Record payment', to: '/finance/payments/new' },
    { label: 'Payments', to: '/finance/payments' },
    { label: 'Fee structures', to: '/finance/fee-structures' },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin/dashboard' },
    { label: 'Users', to: '/admin/users' },
    { label: 'Programs', to: '/admin/programs' },
    { label: 'Courses', to: '/admin/courses' },
    { label: 'Batches', to: '/admin/batches' },
    { label: 'Timetable', to: '/admin/timetable' },
    { label: 'Tickets', to: '/admin/tickets' },
    { label: 'Enrolments', to: '/admin/enrollments' },
    { label: 'Audit log', to: '/admin/audit-logs' },
  ],
  superadmin: [
    { label: 'Dashboard', to: '/admin/dashboard' },
    { label: 'Users', to: '/admin/users' },
    { label: 'Tickets', to: '/admin/tickets' },
    { label: 'Audit log', to: '/admin/audit-logs' },
  ],
};

export function AppShell({ children }: PropsWithChildren) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Lock body scroll while the mobile drawer is open so the underlying page
  // doesn't move under the trapped overlay.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  if (!user) return null;

  const nav = NAV_BY_ROLE[user.role as Role] ?? [];
  const readOnly = user.role === 'superadmin';

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // ignore — server may already have expired the session
    }
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-brand-cream text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-brand-navy focus:text-white focus:px-3 focus:py-2 focus:rounded"
      >
        Skip to main content
      </a>
      <ServiceWorkerUpdateBanner />
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-brand-navy text-white border-b border-white/10">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14 gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden h-9 w-9 grid place-items-center rounded hover:bg-white/10"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link to={nav[0]?.to ?? '/'} className="flex items-center gap-2 font-semibold">
              <span className="h-7 w-7 rounded-lg bg-brand-orange text-brand-navy grid place-items-center font-extrabold text-sm">
                IL
              </span>
              <span className="hidden sm:inline">India Learns</span>
            </Link>
            {readOnly && (
              <Badge tone="warning" className="hidden sm:inline-flex">Read-only</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden sm:block text-right leading-tight">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-white/60 capitalize">{user.role}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-white/90 hover:text-white border border-white/20 rounded-lg px-3 h-9 hover:bg-white/10 transition"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] min-h-[calc(100vh-3.5rem)]">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:block border-r border-black/5 bg-white py-4">
          <SidebarNav nav={nav} />
        </aside>

        {/* Sidebar — mobile drawer */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <FocusTrap
              active
              focusTrapOptions={{
                escapeDeactivates: () => {
                  setMenuOpen(false);
                  return true;
                },
                clickOutsideDeactivates: true,
              }}
            >
              <aside
                className="fixed left-0 top-14 bottom-0 w-64 bg-white z-50 lg:hidden border-r border-black/10 py-4 overflow-y-auto"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
              >
                <SidebarNav
                  nav={nav}
                  onNavigate={() => setMenuOpen(false)}
                />
              </aside>
            </FocusTrap>
          </>
        )}

        {/* Content */}
        <main id="main-content" className="px-4 sm:px-6 py-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>
      <MobileBottomTabs />
      <InstallPrompt />
    </div>
  );
}

function SidebarNav({ nav, onNavigate }: { nav: NavEntry[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col">
      {nav.map((entry) => (
        <NavLink
          key={entry.to}
          to={entry.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'px-6 py-2.5 text-sm font-medium border-l-4 transition',
              isActive
                ? 'border-brand-orange text-brand-navy bg-brand-cream'
                : 'border-transparent text-muted hover:text-brand-navy hover:bg-brand-cream/50',
            )
          }
        >
          {entry.label}
        </NavLink>
      ))}
      <div className="mt-auto border-t border-black/5 pt-4 mx-6">
        <NavLink
          to="/profile"
          className="text-sm text-muted hover:text-brand-navy block py-1"
          onClick={onNavigate}
        >
          Profile
        </NavLink>
        <NavLink
          to="/profile/notifications"
          className="text-sm text-muted hover:text-brand-navy block py-1"
          onClick={onNavigate}
        >
          Notifications
        </NavLink>
      </div>
    </nav>
  );
}
