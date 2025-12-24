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

export function useGymUsers() {
  return useQuery({
    queryKey: ['gym-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gym_users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as GymUser[];
    },
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
