import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';

export interface GymSchedule {
  id: string;
  gym_user_id: string;
  schedule_time: string;
  created_at: string;
}

export interface GymScheduleWithUser extends GymSchedule {
  gym_users: {
    id: string;
    name: string;
    employee_id: string;
  } | null;
}

export function useGymSchedules(filter: 'all' | 'today' | 'week' = 'all') {
  return useQuery({
    queryKey: ['gym-schedules', filter],
    queryFn: async () => {
      let query = supabase
        .from('gym_schedules')
        .select(`
          *,
          gym_users (
            id,
            name,
            employee_id
          )
        `)
        .order('schedule_time', { ascending: true });

      const now = new Date();
      
      if (filter === 'today') {
        query = query
          .gte('schedule_time', startOfDay(now).toISOString())
          .lte('schedule_time', endOfDay(now).toISOString());
      } else if (filter === 'week') {
        query = query
          .gte('schedule_time', startOfWeek(now, { weekStartsOn: 1 }).toISOString())
          .lte('schedule_time', endOfWeek(now, { weekStartsOn: 1 }).toISOString());
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as GymScheduleWithUser[];
    },
  });
}

export function useUserSchedules(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-schedules', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('gym_schedules')
        .select('*')
        .eq('gym_user_id', userId)
        .order('schedule_time', { ascending: true });
      
      if (error) throw error;
      return data as GymSchedule[];
    },
    enabled: !!userId,
  });
}

export function useUpcomingSchedules(limit: number = 5) {
  return useQuery({
    queryKey: ['upcoming-schedules', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gym_schedules')
        .select(`
          *,
          gym_users (
            id,
            name,
            employee_id
          )
        `)
        .gte('schedule_time', new Date().toISOString())
        .order('schedule_time', { ascending: true })
        .limit(limit);
      
      if (error) throw error;
      return data as GymScheduleWithUser[];
    },
  });
}

export function useTodaySchedulesCount() {
  return useQuery({
    queryKey: ['today-schedules-count'],
    queryFn: async () => {
      const now = new Date();
      const { count, error } = await supabase
        .from('gym_schedules')
        .select('*', { count: 'exact', head: true })
        .gte('schedule_time', startOfDay(now).toISOString())
        .lte('schedule_time', endOfDay(now).toISOString());
      
      if (error) throw error;
      return count || 0;
    },
  });
}

export function useNextScheduleForUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['next-schedule', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('gym_schedules')
        .select('*')
        .eq('gym_user_id', userId)
        .gte('schedule_time', new Date().toISOString())
        .order('schedule_time', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as GymSchedule | null;
    },
    enabled: !!userId,
  });
}

export function useAddSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (scheduleData: { gym_user_id: string; schedule_time: string }) => {
      const { data, error } = await supabase
        .from('gym_schedules')
        .insert(scheduleData)
        .select()
        .single();
      
      if (error) throw error;
      return data as GymSchedule;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gym-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['user-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['today-schedules-count'] });
      queryClient.invalidateQueries({ queryKey: ['next-schedule'] });
      toast({
        title: "Schedule Added",
        description: `Schedule for ${format(new Date(data.schedule_time), 'MMM d, h:mm a')} has been added.`,
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

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from('gym_schedules')
        .delete()
        .eq('id', scheduleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['user-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['today-schedules-count'] });
      queryClient.invalidateQueries({ queryKey: ['next-schedule'] });
      toast({
        title: "Schedule Deleted",
        description: "The schedule has been removed.",
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
