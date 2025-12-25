import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, subDays, format, getHours } from 'date-fns';

export interface HourlyData {
  hour: string;
  count: number;
}

export interface DailyData {
  day: string;
  total: number;
  completed: number;
  noShow: number;
}

export interface OccupancyPattern {
  time: string;
  avgOccupancy: number;
}

export function usePeakHoursData() {
  return useQuery({
    queryKey: ['analytics-peak-hours'],
    queryFn: async () => {
      const today = new Date();
      const { data, error } = await supabase
        .from('gym_schedules')
        .select('schedule_time, check_in_time')
        .gte('schedule_time', startOfDay(today).toISOString())
        .lte('schedule_time', endOfDay(today).toISOString());

      if (error) throw error;

      // Group by hour
      const hourCounts: Record<number, number> = {};
      for (let i = 6; i <= 22; i++) {
        hourCounts[i] = 0;
      }

      data?.forEach((schedule) => {
        const hour = getHours(new Date(schedule.schedule_time));
        if (hour >= 6 && hour <= 22) {
          hourCounts[hour]++;
        }
      });

      return Object.entries(hourCounts).map(([hour, count]) => ({
        hour: `${hour}:00`,
        count,
      })) as HourlyData[];
    },
  });
}

export function useWeeklyTrendsData() {
  return useQuery({
    queryKey: ['analytics-weekly-trends'],
    queryFn: async () => {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 0 });

      const { data, error } = await supabase
        .from('gym_schedules')
        .select('schedule_time, status')
        .gte('schedule_time', weekStart.toISOString())
        .lte('schedule_time', weekEnd.toISOString());

      if (error) throw error;

      // Group by day of week
      const dayData: Record<string, { total: number; completed: number; noShow: number }> = {};
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      days.forEach((day) => {
        dayData[day] = { total: 0, completed: 0, noShow: 0 };
      });

      data?.forEach((schedule) => {
        const day = format(new Date(schedule.schedule_time), 'EEE');
        if (dayData[day]) {
          dayData[day].total++;
          if (schedule.status === 'OUT') {
            dayData[day].completed++;
          } else if (schedule.status === 'NO_SHOW') {
            dayData[day].noShow++;
          }
        }
      });

      return days.map((day) => ({
        day,
        ...dayData[day],
      })) as DailyData[];
    },
  });
}

export function useOccupancyPatternData() {
  return useQuery({
    queryKey: ['analytics-occupancy-pattern'],
    queryFn: async () => {
      const today = new Date();
      const lastWeek = subDays(today, 7);

      const { data, error } = await supabase
        .from('gym_schedules')
        .select('schedule_time, check_in_time, check_out_time, status')
        .gte('schedule_time', lastWeek.toISOString())
        .in('status', ['IN_GYM', 'OUT']);

      if (error) throw error;

      // Calculate average occupancy by hour over the past week
      const hourOccupancy: Record<number, number[]> = {};
      for (let i = 6; i <= 22; i++) {
        hourOccupancy[i] = [];
      }

      // For each day, count how many people were in the gym at each hour
      const dayGroups: Record<string, typeof data> = {};
      data?.forEach((schedule) => {
        const dayKey = format(new Date(schedule.schedule_time), 'yyyy-MM-dd');
        if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
        dayGroups[dayKey].push(schedule);
      });

      Object.values(dayGroups).forEach((daySchedules) => {
        for (let hour = 6; hour <= 22; hour++) {
          let count = 0;
          daySchedules.forEach((schedule) => {
            const checkIn = schedule.check_in_time ? getHours(new Date(schedule.check_in_time)) : null;
            const checkOut = schedule.check_out_time ? getHours(new Date(schedule.check_out_time)) : 23;
            if (checkIn !== null && checkIn <= hour && checkOut >= hour) {
              count++;
            }
          });
          hourOccupancy[hour].push(count);
        }
      });

      return Object.entries(hourOccupancy).map(([hour, counts]) => ({
        time: `${hour}:00`,
        avgOccupancy: counts.length > 0 
          ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10 
          : 0,
      })) as OccupancyPattern[];
    },
  });
}

export function useMonthlyStats() {
  return useQuery({
    queryKey: ['analytics-monthly-stats'],
    queryFn: async () => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('gym_schedules')
        .select('status')
        .gte('schedule_time', monthStart.toISOString())
        .lte('schedule_time', monthEnd.toISOString());

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        completed: data?.filter(s => s.status === 'OUT').length || 0,
        inProgress: data?.filter(s => s.status === 'IN_GYM').length || 0,
        noShow: data?.filter(s => s.status === 'NO_SHOW').length || 0,
        booked: data?.filter(s => s.status === 'BOOKED').length || 0,
      };

      return stats;
    },
  });
}
