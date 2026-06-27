import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek, format } from 'date-fns';

export interface DailyData {
  day: string;
  total: number;
  completed: number;
  noShow: number;
  approved: number;
  rejected: number;
}

export interface SessionToday {
  schedule_id: number;
  session_name: string;
  time_start: string;
  time_end: string | null;
  quota: number;
  booked: number;
  checkedIn: number;
  noShow: number;
}

export interface GenderBreakdown {
  male: number;
  female: number;
  unknown: number;
  total: number;
}

export interface TodayBreakdown {
  sessions: SessionToday[];
  gender: GenderBreakdown;
}

interface BookingRow {
  booking_date?: string;
  schedule_id?: number | null;
  status?: string | null;
  approval_status?: string | null;
  gender?: string | null;
}

interface AvailabilityRow {
  schedule_id?: number;
  session_name?: string;
  time_start?: string;
  time_end?: string | null;
  quota?: number;
}

// Fetch /api/<path> first, fall back to the bare /<path> (dev/prod proxy variance).
async function fetchJson<T>(path: string): Promise<T | null> {
  for (const url of [`/api/${path}`, `/${path}`]) {
    try {
      const r = await fetch(url);
      return (await r.json()) as T;
    } catch (_) {
      // try the next base
    }
  }
  return null;
}

export function useWeeklyTrendsData() {
  return useQuery({
    queryKey: ['analytics-weekly-trends'],
    queryFn: async (): Promise<DailyData[]> => {
      const today = new Date();
      const from = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const to = format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const j = await fetchJson<{ ok: boolean; bookings?: BookingRow[]; error?: string }>(
        `gym-bookings?from=${from}&to=${to}`
      );
      if (!j || !j.ok) throw new Error(j?.error || 'Failed to load bookings');
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayData: Record<string, Omit<DailyData, 'day'>> = {};
      days.forEach((day) => {
        dayData[day] = { total: 0, completed: 0, noShow: 0, approved: 0, rejected: 0 };
      });
      (j.bookings || []).forEach((b) => {
        const day = format(new Date(String(b.booking_date)), 'EEE');
        const status = String(b.status || '').toUpperCase();
        const appr = String(b.approval_status || '').toUpperCase();
        if (dayData[day]) {
          dayData[day].total++;
          if (status === 'COMPLETED' || status === 'OUT') dayData[day].completed++;
          if (status === 'EXPIRED' || status === 'CANCELLED') dayData[day].noShow++;
          if (appr === 'APPROVED') dayData[day].approved++;
          if (appr === 'REJECTED') dayData[day].rejected++;
        }
      });
      return days.map((day) => ({ day, ...dayData[day] }));
    },
  });
}

// Today's bookings grouped per session (the gym runs on fixed sessions, so this
// is far clearer than an hourly breakdown) plus the gender split of today's
// active bookings.
export function useTodayBreakdown() {
  return useQuery({
    queryKey: ['analytics-today-breakdown'],
    queryFn: async (): Promise<TodayBreakdown> => {
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const availability = await fetchJson<{ success: boolean; sessions?: AvailabilityRow[] }>(
        `gym-availability?date=${dateStr}`
      );
      const sessions = availability && availability.success && Array.isArray(availability.sessions)
        ? availability.sessions
        : [];
      const bookingsRes = await fetchJson<{ ok: boolean; bookings?: BookingRow[] }>(
        `gym-bookings?from=${dateStr}&to=${dateStr}`
      );
      const bookings = bookingsRes && bookingsRes.ok && Array.isArray(bookingsRes.bookings)
        ? bookingsRes.bookings
        : [];

      const bySched: Record<number, { booked: number; checkedIn: number; noShow: number }> = {};
      bookings.forEach((b) => {
        const sid = Number(b.schedule_id);
        if (!Number.isFinite(sid)) return;
        const status = String(b.status || '').toUpperCase();
        const appr = String(b.approval_status || '').toUpperCase();
        if (status === 'CANCELLED' || appr === 'REJECTED') return; // freed the slot
        if (!bySched[sid]) bySched[sid] = { booked: 0, checkedIn: 0, noShow: 0 };
        bySched[sid].booked++;
        if (['CHECKIN', 'COMPLETED', 'OUT'].includes(status)) bySched[sid].checkedIn++;
        if (status === 'EXPIRED') bySched[sid].noShow++;
      });

      const gender: GenderBreakdown = { male: 0, female: 0, unknown: 0, total: 0 };
      bookings.forEach((b) => {
        const status = String(b.status || '').toUpperCase();
        const appr = String(b.approval_status || '').toUpperCase();
        if (status === 'CANCELLED' || appr === 'REJECTED') return; // exclude freed slots
        const g = String(b.gender || '').trim().toUpperCase();
        gender.total++;
        if (g === 'M' || g === 'MALE') gender.male++;
        else if (g === 'F' || g === 'FEMALE') gender.female++;
        else gender.unknown++;
      });

      const sessionList = sessions
        .map((s) => {
          const sid = Number(s.schedule_id) || 0;
          const agg = bySched[sid] || { booked: 0, checkedIn: 0, noShow: 0 };
          return {
            schedule_id: sid,
            session_name: String(s.session_name || ''),
            time_start: String(s.time_start || ''),
            time_end: s.time_end != null ? String(s.time_end) : null,
            quota: Number(s.quota || 15),
            booked: agg.booked,
            checkedIn: agg.checkedIn,
            noShow: agg.noShow,
          };
        })
        .sort((a, b) => a.time_start.localeCompare(b.time_start));

      return { sessions: sessionList, gender };
    },
    staleTime: 30000,
  });
}
