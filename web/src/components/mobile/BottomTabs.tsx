import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import type { Role } from 'india-learns-shared-types';
import { useAuthStore } from '../../store/auth.js';

interface Tab {
  label: string;
  to: string;
  icon: JSX.Element;
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const TABS_BY_ROLE: Record<Role, Tab[]> = {
  student: [
    {
      label: 'Home',
      to: '/student/dashboard',
      icon: <Icon><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z" /></Icon>,
    },
    {
      label: 'Courses',
      to: '/student/courses',
      icon: <Icon><path d="M4 5h16v14H4z" /><path d="M4 9h16" /></Icon>,
    },
    {
      label: 'Schedule',
      to: '/student/timetable',
      icon: <Icon><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M16 3v4M8 3v4M4 11h16" /></Icon>,
    },
    {
      label: 'Fees',
      to: '/student/fees',
      icon: <Icon><path d="M3 7h18M3 12h18M3 17h18" /></Icon>,
    },
    {
      label: 'Tickets',
      to: '/student/tickets',
      icon: <Icon><path d="M3 7h18v4a2 2 0 000 4v4H3v-4a2 2 0 000-4z" /></Icon>,
    },
  ],
  faculty: [
    {
      label: 'Home',
      to: '/faculty/dashboard',
      icon: <Icon><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z" /></Icon>,
    },
    {
      label: 'Courses',
      to: '/faculty/courses',
      icon: <Icon><path d="M4 5h16v14H4z" /><path d="M4 9h16" /></Icon>,
    },
    {
      label: 'Grading',
      to: '/faculty/grading',
      icon: <Icon><path d="M5 3l7 4v14l-7-4z" /><path d="M12 7l7-4v14l-7 4z" /></Icon>,
    },
    {
      label: 'Feedback',
      to: '/faculty/feedback',
      icon: <Icon><path d="M21 12a9 9 0 11-3.6-7.2L21 3v6h-6" /></Icon>,
    },
  ],
  finance: [
    {
      label: 'Home',
      to: '/finance/dashboard',
      icon: <Icon><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z" /></Icon>,
    },
    {
      label: 'Record',
      to: '/finance/payments/new',
      icon: <Icon><path d="M12 5v14M5 12h14" /></Icon>,
    },
    {
      label: 'Payments',
      to: '/finance/payments',
      icon: <Icon><path d="M3 7h18v10H3z" /><path d="M3 11h18" /></Icon>,
    },
    {
      label: 'Students',
      to: '/finance/students',
      icon: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></Icon>,
    },
  ],
  admin: [
    {
      label: 'Home',
      to: '/admin/dashboard',
      icon: <Icon><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z" /></Icon>,
    },
    {
      label: 'Users',
      to: '/admin/users',
      icon: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></Icon>,
    },
    {
      label: 'Tickets',
      to: '/admin/tickets',
      icon: <Icon><path d="M3 7h18v4a2 2 0 000 4v4H3v-4a2 2 0 000-4z" /></Icon>,
    },
    {
      label: 'Analytics',
      to: '/admin/dashboard',
      icon: <Icon><path d="M3 17l6-6 4 4 8-8" /></Icon>,
    },
  ],
  superadmin: [
    {
      label: 'Home',
      to: '/admin/dashboard',
      icon: <Icon><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z" /></Icon>,
    },
    {
      label: 'Users',
      to: '/admin/users',
      icon: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></Icon>,
    },
    {
      label: 'Tickets',
      to: '/admin/tickets',
      icon: <Icon><path d="M3 7h18v4a2 2 0 000 4v4H3v-4a2 2 0 000-4z" /></Icon>,
    },
    {
      label: 'Audit',
      to: '/admin/audit-logs',
      icon: <Icon><path d="M9 12l2 2 4-4M5 4h14v16H5z" /></Icon>,
    },
  ],
  // Admissions M1 — minimal mobile nav (one-tab) for the two new roles.
  applicant: [
    {
      label: 'Application',
      to: '/apply/portal',
      icon: <Icon><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z" /></Icon>,
    },
  ],
  admissions_officer: [
    {
      label: 'Applications',
      to: '/admissions/dashboard',
      icon: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></Icon>,
    },
  ],
};

/**
 * Mobile-only bottom navigation, shown below `md` breakpoint. Mirrors the
 * desktop sidebar's primary actions per the mobile mockups.
 */
export function MobileBottomTabs() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  const tabs = TABS_BY_ROLE[user.role as Role];
  if (!tabs) return null;
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-white border-t border-black/10 flex items-stretch"
      aria-label="Primary"
    >
      {tabs.map((t) => (
        <NavLink
          key={t.label}
          to={t.to}
          end={false}
          className={({ isActive }) =>
            clsx(
              'flex-1 flex flex-col items-center justify-center py-2 text-[11px]',
              isActive
                ? 'text-brand-orange font-semibold'
                : 'text-muted hover:text-brand-navy',
            )
          }
        >
          {t.icon}
          <span className="mt-0.5">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
