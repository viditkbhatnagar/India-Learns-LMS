import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
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
  icon: ReactNode;
}

// Icon bank — inline SVGs so no extra runtime library. 20×20, stroke 1.75.
const Icon = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3Z" />
      <path d="M4 17a3 3 0 0 1 3-3h12" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  ),
  rupee: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M6 4h12M6 8h12M8 4c3.5 0 5 2 5 4s-1.5 4-5 4h-2l8 8" />
    </svg>
  ),
  ticket: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
      <path d="M10 6v12" />
    </svg>
  ),
  feedback: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M21 12c0 4.4-4 8-9 8a9.7 9.7 0 0 1-3.3-.6L3 21l1.6-4.3A7.7 7.7 0 0 1 3 12c0-4.4 4-8 9-8s9 3.6 9 8Z" />
    </svg>
  ),
  award: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="10" r="6" /><path d="M8 14v7l4-3 4 3v-7" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6" /><path d="M16 11a4 4 0 0 0 0-8" /><path d="M22 21c0-3-2-5-5-5.5" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /><path d="m3 17 9 5 9-5" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
};

const NAV_BY_ROLE: Record<Role, NavEntry[]> = {
  student: [
    { label: 'Dashboard', to: '/student/dashboard', icon: Icon.home },
    { label: 'Courses', to: '/student/courses', icon: Icon.book },
    { label: 'Timetable', to: '/student/timetable', icon: Icon.calendar },
    { label: 'Fees', to: '/student/fees', icon: Icon.rupee },
    { label: 'Tickets', to: '/student/tickets', icon: Icon.ticket },
    { label: 'Feedback', to: '/student/feedback', icon: Icon.feedback },
    { label: 'Certificates', to: '/student/certificates', icon: Icon.award },
  ],
  faculty: [
    { label: 'Dashboard', to: '/faculty/dashboard', icon: Icon.home },
    { label: 'Courses', to: '/faculty/courses', icon: Icon.book },
    { label: 'Grading', to: '/faculty/grading', icon: Icon.feedback },
    { label: 'Feedback', to: '/faculty/feedback', icon: Icon.feedback },
    { label: 'Timetable', to: '/faculty/timetable', icon: Icon.calendar },
  ],
  finance: [
    { label: 'Dashboard', to: '/finance/dashboard', icon: Icon.home },
    { label: 'Record payment', to: '/finance/payments/new', icon: Icon.plus },
    { label: 'Payments', to: '/finance/payments', icon: Icon.rupee },
    { label: 'Fee structures', to: '/finance/fee-structures', icon: Icon.folder },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: Icon.home },
    { label: 'Users', to: '/admin/users', icon: Icon.users },
    { label: 'Programs', to: '/admin/programs', icon: Icon.layers },
    { label: 'Courses', to: '/admin/courses', icon: Icon.book },
    { label: 'Batches', to: '/admin/batches', icon: Icon.grid },
    { label: 'Timetable', to: '/admin/timetable', icon: Icon.calendar },
    { label: 'Tickets', to: '/admin/tickets', icon: Icon.ticket },
    { label: 'Enrolments', to: '/admin/enrollments', icon: Icon.users },
    { label: 'Audit log', to: '/admin/audit-logs', icon: Icon.history },
  ],
  superadmin: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: Icon.home },
    { label: 'Users', to: '/admin/users', icon: Icon.users },
    { label: 'Tickets', to: '/admin/tickets', icon: Icon.ticket },
    { label: 'Audit log', to: '/admin/audit-logs', icon: Icon.history },
  ],
};

export function AppShell({ children }: PropsWithChildren) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

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

  const firstInitial = (user.name ?? '?').trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:bg-brand-navy focus:text-white focus:px-3 focus:py-2 focus:rounded-lg focus:shadow-elev-3"
      >
        Skip to main content
      </a>
      <ServiceWorkerUpdateBanner />

      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-brand-navy text-white shadow-elev-2">
        <div className="flex items-center justify-between px-4 sm:px-6 h-16 gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden h-9 w-9 grid place-items-center rounded-lg hover:bg-white/10 transition"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link
              to={nav[0]?.to ?? '/'}
              className="flex items-center gap-2.5 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-lg"
            >
              <img
                src="/brand/logo.jpg"
                alt=""
                aria-hidden="true"
                className="h-8 w-auto rounded-md shadow-elev-1"
              />
              <span className="sr-only sm:not-sr-only tracking-tight">India Learns</span>
            </Link>
            {readOnly && (
              <Badge tone="warning" className="hidden sm:inline-flex">
                Read-only
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-white/15">
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-white/60 capitalize">{user.role}</p>
              </div>
              <div
                aria-hidden
                className="h-9 w-9 rounded-full bg-brand-orange text-white font-bold grid place-items-center shadow-glow-orange"
              >
                {firstInitial}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm font-medium text-white/90 hover:text-white border border-white/20 rounded-lg px-3 h-9 hover:bg-white/10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] min-h-[calc(100vh-4rem)]">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex flex-col border-r border-black/5 bg-white/80 backdrop-blur-sm py-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <SidebarNav nav={nav} role={user.role as Role} />
        </aside>

        {/* Sidebar — mobile drawer */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
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
                className="fixed left-0 top-16 bottom-0 w-72 bg-white z-50 lg:hidden border-r border-black/10 py-6 overflow-y-auto animate-slide-in-right shadow-elev-4"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
              >
                <SidebarNav
                  nav={nav}
                  role={user.role as Role}
                  onNavigate={() => setMenuOpen(false)}
                />
              </aside>
            </FocusTrap>
          </>
        )}

        {/* Content */}
        <main
          id="main-content"
          className="px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8 max-w-[1400px] w-full mx-auto"
        >
          {children}
        </main>
      </div>
      <MobileBottomTabs />
      <InstallPrompt />
    </div>
  );
}

function SidebarNav({
  nav,
  role,
  onNavigate,
}: {
  nav: NavEntry[];
  role: Role;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 flex flex-col px-3">
      <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.12em] text-muted font-bold">
        Main
      </p>
      <div className="flex flex-col gap-1">
        {nav.map((entry) => (
          <NavLink
            key={entry.to}
            to={entry.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium',
                'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30',
                isActive
                  ? 'bg-brand-navy text-white shadow-elev-2'
                  : 'text-ink/70 hover:text-brand-navy hover:bg-navy-50',
              )
            }
            end={entry.to.endsWith('/dashboard')}
          >
            {({ isActive }) => (
              <>
                <span
                  className={clsx(
                    'shrink-0',
                    isActive ? 'text-white' : 'text-muted group-hover:text-brand-navy',
                  )}
                >
                  {entry.icon}
                </span>
                <span className="truncate">{entry.label}</span>
                {isActive && (
                  <span
                    aria-hidden
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-orange shadow-glow-orange"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {(role === 'student' || role === 'faculty' || role === 'finance' || role === 'admin' || role === 'superadmin') && (
        <>
          <p className="px-3 mt-8 mb-2 text-[10px] uppercase tracking-[0.12em] text-muted font-bold">
            Account
          </p>
          <div className="flex flex-col gap-1">
            <NavLink
              to="/profile"
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? 'bg-navy-50 text-brand-navy'
                    : 'text-ink/70 hover:text-brand-navy hover:bg-navy-50',
                )
              }
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              </svg>
              Profile
            </NavLink>
            <NavLink
              to="/profile/notifications"
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? 'bg-navy-50 text-brand-navy'
                    : 'text-ink/70 hover:text-brand-navy hover:bg-navy-50',
                )
              }
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
                <path d="M9 17a3 3 0 0 0 6 0" />
              </svg>
              Notifications
            </NavLink>
          </div>
        </>
      )}
    </nav>
  );
}
