import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'admin' | 'user' | 'superadmin' | 'committee';

export function useUserRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
    } else {
      setRoles([user.role as AppRole]);
    }
    setIsLoading(false);
  }, [user]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isSuperAdmin = hasRole('superadmin');
  const isCommittee = hasRole('committee');
  const isAdmin = hasRole('admin') || isSuperAdmin;

  return {
    roles,
    isLoading,
    hasRole,
    isSuperAdmin,
    isCommittee,
    isAdmin,
  };
}
