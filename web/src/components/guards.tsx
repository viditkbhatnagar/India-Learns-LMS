import { Navigate, useLocation } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import type { Role } from 'india-learns-shared-types';
import { useAuthStore } from '../store/auth.js';
import { AppShell } from './AppShell.js';

export function RequireAuth({ children }: PropsWithChildren) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const location = useLocation();
  if (!user || !token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <AppShell>{children}</AppShell>;
}

export function RequireRole({ roles, children }: PropsWithChildren<{ roles: Role[] }>) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role as Role)) {
    const fallback = defaultRouteForRole(user.role as Role);
    return <Navigate to={fallback} replace />;
  }
  return children;
}

export function defaultRouteForRole(role: Role): string {
  switch (role) {
    case 'student':
      return '/student/dashboard';
    case 'faculty':
      return '/faculty/dashboard';
    // M10r — `finance` role removed; admin owns finance now.
    case 'admin':
    case 'superadmin':
      return '/admin/dashboard';
    case 'applicant':
      return '/apply/portal';
    case 'admissions_officer':
      return '/admissions/dashboard';
    default:
      return '/login';
  }
}
