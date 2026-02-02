import { useQuery } from '@tanstack/react-query';
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
      const dateStr = format(today, 'yyyy-MM-dd');
      const r = await fetch(`/api/gym-bookings?from=${dateStr}&to=${dateStr}`).catch(() => fetch(`/gym-bookings?from=${dateStr}&to=${dateStr}`));
      const j: { ok: boolean; bookings?: Array<{ booking_date: string; time_start: string | null }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load bookings');
      const hourCounts: Record<number, number> = {};
      for (let i = 6; i <= 22; i++) hourCounts[i] = 0;
      (j.bookings || []).forEach((b) => {
        const hhmm = b.time_start || '00:00';
        const hour = Number(hhmm.split(':')[0] || '0');
        if (hour >= 6 && hour <= 22) hourCounts[hour]++;
      });
      return Object.entries(hourCounts).map(([hour, count]) => ({ hour: `${hour}:00`, count })) as HourlyData[];
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
      const from = format(weekStart, 'yyyy-MM-dd');
      const to = format(weekEnd, 'yyyy-MM-dd');
      const r = await fetch(`/api/gym-bookings?from=${from}&to=${to}`).catch(() => fetch(`/gym-bookings?from=${from}&to=${to}`));
      const j: { ok: boolean; bookings?: Array<{ booking_date: string; status: string }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load bookings');
      const dayData: Record<string, { total: number; completed: number; noShow: number }> = {};
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      days.forEach((day) => { dayData[day] = { total: 0, completed: 0, noShow: 0 }; });
      (j.bookings || []).forEach((b) => {
        const day = format(new Date(b.booking_date), 'EEE');
        const status = String(b.status).toUpperCase();
        if (dayData[day]) {
          dayData[day].total++;
          if (status === 'COMPLETED' || status === 'OUT') dayData[day].completed++;
          if (status === 'EXPIRED' || status === 'CANCELLED') dayData[day].noShow++;
        }
      });
      return days.map((day) => ({ day, ...dayData[day] })) as DailyData[];
    },
  });
}

export function useOccupancyPatternData() {
  return useQuery({
    queryKey: ['analytics-occupancy-pattern'],
    queryFn: async () => {
      const today = new Date();
      const from = format(startOfDay(subDays(today, 7)), 'yyyy-MM-dd');
      const to = format(endOfDay(today), 'yyyy-MM-dd');
      const r = await fetch(`/api/gym-bookings?from=${from}&to=${to}`).catch(() => fetch(`/gym-bookings?from=${from}&to=${to}`));
      const j: { ok: boolean; bookings?: Array<{ booking_date: string; time_start: string | null; status: string }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load bookings');
      const hourActual: Record<number, number[]> = {};
      const hourBooked: Record<number, number[]> = {};
      for (let i = 6; i <= 22; i++) { hourActual[i] = []; hourBooked[i] = []; }
      const dayGroups: Record<string, Array<{ hour: number; status: string }>> = {};
      (j.bookings || []).forEach((b) => {
        const dayKey = b.booking_date;
        const hour = Number((b.time_start || '00:00').split(':')[0] || '0');
        const status = String(b.status).toUpperCase();
        if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
        dayGroups[dayKey].push({ hour, status });
      });
      Object.values(dayGroups).forEach((dayBookings) => {
        for (let hour = 6; hour <= 22; hour++) {
          const countActual = dayBookings.filter((b) => b.hour === hour && (b.status === 'CHECKIN' || b.status === 'COMPLETED')).length;
          const countBooked = dayBookings.filter((b) => b.hour === hour && b.status === 'BOOKED').length;
          hourActual[hour].push(countActual);
          hourBooked[hour].push(countBooked);
        }
      });
      const actualSum = Object.values(hourActual).reduce((acc, arr) => acc + arr.reduce((a, b) => a + b, 0), 0);
      const source = actualSum > 0 ? hourActual : hourBooked;
      return Object.entries(source).map(([hour, counts]) => ({
        time: `${hour}:00`,
        avgOccupancy: counts.length > 0 ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10 : 0,
      })) as OccupancyPattern[];
    },
  });
}

export function useMonthlyStats() {
  return useQuery({
    queryKey: ['analytics-monthly-stats'],
    queryFn: async () => {
      const today = new Date();
      const monthStart = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');
      const monthEnd = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd');
      const r = await fetch(`/api/gym-bookings?from=${monthStart}&to=${monthEnd}`).catch(() => fetch(`/gym-bookings?from=${monthStart}&to=${monthEnd}`));
      const j: { ok: boolean; bookings?: Array<{ status: string }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load bookings');
      const bookings = j.bookings || [];
      const stats = {
        total: bookings.length,
        completed: bookings.filter((s) => ['COMPLETED', 'OUT'].includes(String(s.status).toUpperCase())).length,
        inProgress: bookings.filter((s) => String(s.status).toUpperCase() === 'CHECKIN').length,
        noShow: bookings.filter((s) => ['EXPIRED', 'CANCELLED'].includes(String(s.status).toUpperCase())).length,
        booked: bookings.filter((s) => String(s.status).toUpperCase() === 'BOOKED').length,
      };
      return stats;
    },
  });
}
