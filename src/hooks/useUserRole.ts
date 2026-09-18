import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'admin' | 'user' | 'superadmin' | 'committee' | 'kingadmin';

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
  const isKingAdmin = hasRole('kingadmin');
  // King Admin can do everything a Super Admin can, so every Super Admin gate lets it in.
  const isSuperAdmin = hasRole('superadmin') || isKingAdmin;
  const isCommittee = hasRole('committee');
  const isAdmin = hasRole('admin') || isSuperAdmin;

  return {
    roles,
    isLoading,
    hasRole,
    isKingAdmin,
    isSuperAdmin,
    isCommittee,
    isAdmin,
  };
}
