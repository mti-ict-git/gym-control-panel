import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VaultUser {
  employee_id: string;
  name: string;
  department: string;
  status: 'ACTIVE' | 'INACTIVE';
  card_no?: string;
}

export function useVaultUsers() {
  return useQuery({
    queryKey: ['vault-users'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('vault-users');
      
      if (error) {
        console.error('Error fetching vault users:', error);
        throw error;
      }

      // Enrich with card_no if missing (since cloud function might not be deployed yet)
      // In production, this data should come directly from the API/Edge Function
      return (data.users || []).map((u: any, i: number) => ({
        ...u,
        card_no: u.card_no || `CN${String(i + 1).padStart(3, '0')}`
      })) as VaultUser[];
    },
  });
}
