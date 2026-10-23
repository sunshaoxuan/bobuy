import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserRole, type UserRole } from '../context/UserRoleContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
}

export default function ProtectedRoute({ children, allowedRoles, redirectTo }: ProtectedRouteProps) {
  const location = useLocation();
  const { roles, isAuthenticated, loading } = useUserRole();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to={location.pathname.startsWith('/admin') ? '/admin' : '/login'} replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.some(role => roles.includes(role))) {
    const defaultRedirect = roles.includes('AGENT') ? '/admin/dashboard' : '/';
    return <Navigate to={redirectTo || defaultRedirect} replace />;
  }

  return <>{children}</>;
}
