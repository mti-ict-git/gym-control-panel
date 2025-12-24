import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';

export type ScheduleStatus = 'BOOKED' | 'IN_GYM' | 'OUT';

export interface GymSchedule {
  id: string;
  gym_user_id: string;
  schedule_time: string;
  status: ScheduleStatus;
  check_in_time: string | null;
  check_out_time: string | null;
  created_at: string;
}

export interface GymScheduleWithUser extends GymSchedule {
  gym_users: {
    id: string;
    name: string;
    employee_id: string;
  } | null;
}

export type FilterType = 'all' | 'today' | 'week' | 'BOOKED' | 'IN_GYM' | 'OUT';

export function useGymSchedules(filter: FilterType = 'all') {
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
      } else if (filter === 'BOOKED' || filter === 'IN_GYM' || filter === 'OUT') {
        query = query.eq('status', filter);
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
        .order('schedule_time', { ascending: false });
      
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

export function useGymOccupancy() {
  return useQuery({
    queryKey: ['gym-occupancy'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('gym_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'IN_GYM');
      
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 5000, // Real-time polling every 5 seconds
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
        .eq('status', 'BOOKED')
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
        .insert({ ...scheduleData, status: 'BOOKED' })
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

export function useCheckIn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      // First check current occupancy
      const { count: currentCount, error: countError } = await supabase
        .from('gym_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'IN_GYM');
      
      if (countError) throw countError;
      
      if ((currentCount || 0) >= 15) {
        throw new Error('GYM_FULL');
      }
      
      const { data, error } = await supabase
        .from('gym_schedules')
        .update({ 
          status: 'IN_GYM', 
          check_in_time: new Date().toISOString() 
        })
        .eq('id', scheduleId)
        .eq('status', 'BOOKED')
        .select()
        .single();
      
      if (error) throw error;
      return data as GymSchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['user-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['gym-occupancy'] });
      toast({
        title: "Checked In",
        description: "User has been checked in successfully.",
      });
    },
    onError: (error: Error) => {
      if (error.message === 'GYM_FULL') {
        // Don't show toast here, let the component handle the dialog
        throw error;
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { data, error } = await supabase
        .from('gym_schedules')
        .update({ 
          status: 'OUT', 
          check_out_time: new Date().toISOString() 
        })
        .eq('id', scheduleId)
        .eq('status', 'IN_GYM')
        .select()
        .single();
      
      if (error) throw error;
      return data as GymSchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['user-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['gym-occupancy'] });
      toast({
        title: "Checked Out",
        description: "User has been checked out successfully.",
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
      queryClient.invalidateQueries({ queryKey: ['gym-occupancy'] });
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
