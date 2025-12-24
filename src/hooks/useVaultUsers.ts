import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VaultUser {
  employee_id: string;
  name: string;
  department: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export function useVaultUsers() {
  return useQuery({
    queryKey: ['vault-users'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('vault-users');
      
      if (error) throw error;
      return data.users as VaultUser[];
    },
  });
}
