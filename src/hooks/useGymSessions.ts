import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GymSession {
  id: string;
  session_name: string;
  time_start: string;
  time_end: string;
  quota: number;
  created_at: string;
  updated_at: string;
}

export type GymSessionInsert = {
  session_name: string;
  time_start: string;
  time_end: string;
  quota: number;
};

export type GymSessionUpdate = {
  id: string;
  session_name?: string;
  time_start?: string;
  time_end?: string;
  quota?: number;
};

export function useGymSessionsList() {
  return useQuery({
    queryKey: ['gym-sessions-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gym_sessions')
        .select('*')
        .order('time_start', { ascending: true });

      if (error) throw error;
      return data as GymSession[];
    },
  });
}

export function useCreateGymSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (session: GymSessionInsert) => {
      const { data, error } = await supabase
        .from('gym_sessions')
        .insert(session)
        .select()
        .single();

      if (error) throw error;
      return data as GymSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-sessions-list'] });
    },
  });
}

export function useUpdateGymSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: GymSessionUpdate) => {
      const { data, error } = await supabase
        .from('gym_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as GymSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-sessions-list'] });
    },
  });
}

export function useDeleteGymSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('gym_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-sessions-list'] });
    },
  });
}

export function formatTime(time: string): string {
  // time is in HH:MM:SS format, convert to HH:MM AM/PM
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}
