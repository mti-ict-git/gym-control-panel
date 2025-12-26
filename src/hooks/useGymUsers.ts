import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GymUser {
  id: string;
  name: string;
  employee_id: string;
  vault_employee_id: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
}

export function useGymUsers(search: string = '', page: number = 1, pageSize: number = 10) {
  return useQuery({
    queryKey: ['gym-users', { search, page, pageSize }],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('gym_users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (search && search.trim().length > 0) {
        const s = `%${search.trim()}%`;
        query = query.or(`name.ilike.${s},employee_id.ilike.${s},department.ilike.${s}`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as GymUser[], total: count ?? 0 };
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useGymUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['gym-user', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('gym_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;
      return data as GymUser | null;
    },
    enabled: !!userId,
  });
}

export function useAddGymUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userData: { name: string; employee_id: string }) => {
      const { data, error } = await supabase
        .from('gym_users')
        .insert(userData)
        .select()
        .single();
      
      if (error) throw error;
      return data as GymUser;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gym-users'] });
      toast({
        title: "User Added",
        description: `${data.name} has been added successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useAddGymUserFromVault() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userData: { 
      vault_employee_id: string; 
      name: string; 
      department: string;
      employee_id: string;
    }) => {
      const { data, error } = await supabase
        .from('gym_users')
        .insert(userData)
        .select()
        .single();
      
      if (error) throw error;
      return data as GymUser;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gym-users'] });
      toast({
        title: "Added to Gym Users",
        description: `${data.name} can now access the gym.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteGymUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('gym_users')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-users'] });
      toast({
        title: "User Deleted",
        description: "The user has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
