import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VaultUser {
  employee_id: string;
  name: string;
  department: string;
  status: 'ACTIVE' | 'INACTIVE';
  card_no?: string;
  session?: string;
}

type VaultUsersResponse = { users?: VaultUser[]; error?: string } | null;

export function useVaultUsers() {
  return useQuery({
    queryKey: ['vault-users'],
    queryFn: async (): Promise<VaultUser[]> => {
      const { data, error } = await supabase.functions.invoke('vault-users');
      if (error) throw error;

      const payload = data as VaultUsersResponse;
      const users = Array.isArray(payload?.users) ? payload!.users! : [];

      // Ensure card numbers are present for display purposes
      return users.map((u, i) => ({
        ...u,
        card_no: u.card_no || `CN${String(i + 1).padStart(3, '0')}`,
      }));
    },
    staleTime: 30_000,
  });
}
