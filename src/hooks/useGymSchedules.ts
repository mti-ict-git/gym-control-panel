import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
      const now = new Date();
      let from = format(startOfDay(now), 'yyyy-MM-dd');
      let to = format(endOfDay(now), 'yyyy-MM-dd');
      if (filter === 'week') {
        from = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        to = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      }
      const r = await fetch(`/api/gym-bookings?from=${from}&to=${to}`).catch(() => fetch(`/gym-bookings?from=${from}&to=${to}`));
      const j: { ok: boolean; bookings?: Array<{ booking_id: number; booking_date: string; time_start: string | null; status: string }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load bookings');
      const rows = (j.bookings || []).filter((b) => {
        if (filter === 'BOOKED' || filter === 'IN_GYM' || filter === 'OUT') return String(b.status).toUpperCase() === filter;
        return true;
      });
      const data: GymScheduleWithUser[] = rows.map((b) => {
        const hhmm = b.time_start || '00:00';
        const [h, m] = hhmm.split(':').map((x) => Number(x));
        const d = new Date(b.booking_date);
        d.setHours(h, m, 0, 0);
        return {
          id: String(b.booking_id),
          gym_user_id: '',
          schedule_time: d.toISOString(),
          status: String(b.status).toUpperCase() as ScheduleStatus,
          check_in_time: null,
          check_out_time: null,
          created_at: new Date().toISOString(),
          gym_users: null,
        };
      });
      return data;
    },
  });
}

export function useUserSchedules(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-schedules', userId],
    queryFn: async () => {
      if (!userId) return [];
      const today = new Date();
      const from = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const to = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const r = await fetch(`/api/gym-bookings-by-employee?employee_id=${encodeURIComponent(userId)}&from=${from}&to=${to}`).catch(() => fetch(`/gym-bookings-by-employee?employee_id=${encodeURIComponent(userId)}&from=${from}&to=${to}`));
      const j: { ok: boolean; bookings?: Array<{ booking_id: number; booking_date: string; time_start: string | null; status: string }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load user bookings');
      const schedules: GymSchedule[] = (j.bookings || []).map((b) => {
        const hhmm = b.time_start || '00:00';
        const [h, m] = hhmm.split(':').map((x) => Number(x));
        const d = new Date(b.booking_date);
        d.setHours(h, m, 0, 0);
        return {
          id: String(b.booking_id),
          gym_user_id: userId,
          schedule_time: d.toISOString(),
          status: String(b.status).toUpperCase() as ScheduleStatus,
          check_in_time: null,
          check_out_time: null,
          created_at: new Date().toISOString(),
        };
      });
      return schedules;
    },
    enabled: !!userId,
  });
}

export function useUpcomingSchedules(limit: number = 5) {
  return useQuery({
    queryKey: ['upcoming-schedules', limit],
    queryFn: async () => {
      const r = await fetch('/api/gym-sessions').catch(() => fetch('/gym-sessions'));
      const j: { ok: boolean; sessions?: Array<{ session_name: string; time_start: string; time_end: string | null; quota: number }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load sessions');
      const sessions = (j.sessions || []).slice(0, limit).map((s, idx) => ({
        id: `session-${s.session_name}-${s.time_start}-${idx}`,
        gym_user_id: '',
        schedule_time: new Date().toISOString(),
        status: 'BOOKED' as ScheduleStatus,
        check_in_time: null,
        check_out_time: null,
        created_at: new Date().toISOString(),
        gym_users: null,
      }));
      return sessions as GymScheduleWithUser[];
    },
  });
}

export function useTodaySchedulesCount() {
  return useQuery({
    queryKey: ['today-schedules-count'],
    queryFn: async () => {
      const now = new Date();
      const dateStr = format(now, 'yyyy-MM-dd');
      const r = await fetch(`/api/gym-bookings?from=${dateStr}&to=${dateStr}`).catch(() => fetch(`/gym-bookings?from=${dateStr}&to=${dateStr}`));
      const j: { ok: boolean; bookings?: unknown[]; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load bookings');
      return Array.isArray(j.bookings) ? j.bookings.length : 0;
    },
  });
}

export function useGymOccupancy(options?: { refetchInterval?: number; staleTime?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ['gym-occupancy'],
    queryFn: async () => {
      const today = new Date();
      const dateStr = format(today, 'yyyy-MM-dd');
      const r = await fetch(`/api/gym-bookings?from=${dateStr}&to=${dateStr}`).catch(() => fetch(`/gym-bookings?from=${dateStr}&to=${dateStr}`));
      const j: { ok: boolean; bookings?: Array<{ status: string }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load bookings');
      const cnt = (j.bookings || []).filter((b) => String(b.status).toUpperCase() === 'CHECKIN').length;
      return cnt;
    },
    refetchInterval: options?.refetchInterval ?? 30000,
    staleTime: options?.staleTime ?? 30000,
    enabled: options?.enabled ?? true,
  });
}

export function useNextScheduleForUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['next-schedule', userId],
    queryFn: async () => {
      if (!userId) return null;
      const now = new Date();
      const from = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const to = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const r = await fetch(`/api/gym-bookings-by-employee?employee_id=${encodeURIComponent(userId)}&from=${from}&to=${to}`).catch(() => fetch(`/gym-bookings-by-employee?employee_id=${encodeURIComponent(userId)}&from=${from}&to=${to}`));
      const j: { ok: boolean; bookings?: Array<{ booking_id: number; booking_date: string; time_start: string | null; status: string }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load user bookings');
      const futureBooked = (j.bookings || [])
        .map((b) => {
          const hhmm = b.time_start || '00:00';
          const [h, m] = hhmm.split(':').map((x) => Number(x));
          const d = new Date(b.booking_date);
          d.setHours(h, m, 0, 0);
          return { b, dt: d };
        })
        .filter(({ b, dt }) => String(b.status).toUpperCase() === 'BOOKED' && dt.getTime() > now.getTime())
        .sort((a, b) => a.dt.getTime() - b.dt.getTime());
      const first = futureBooked[0];
      if (!first) return null;
      const statusUpper = String(first.b.status).toUpperCase();
      const statusMap: Record<string, ScheduleStatus> = { BOOKED: 'BOOKED', CHECKIN: 'IN_GYM', COMPLETED: 'OUT' };
      const mappedStatus: ScheduleStatus = statusMap[statusUpper] ?? 'BOOKED';
      return {
        id: String(first.b.booking_id),
        gym_user_id: userId,
        schedule_time: first.dt.toISOString(),
        status: mappedStatus,
        check_in_time: null,
        check_out_time: null,
        created_at: new Date().toISOString(),
      } as GymSchedule;
    },
    enabled: !!userId,
  });
}

export function useMostRelevantSchedule(userId: string | undefined) {
  return useQuery({
    queryKey: ['relevant-schedule', userId],
    queryFn: async () => {
      if (!userId) return null;
      const today = new Date();
      const fromToday = format(startOfDay(today), 'yyyy-MM-dd');
      const toToday = format(endOfDay(today), 'yyyy-MM-dd');
      const weekFrom = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekTo = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');

      const fetchBookings = async (from: string, to: string) => {
        const r = await fetch(`/api/gym-bookings-by-employee?employee_id=${encodeURIComponent(userId!)}&from=${from}&to=${to}`).catch(() => fetch(`/gym-bookings-by-employee?employee_id=${encodeURIComponent(userId!)}&from=${from}&to=${to}`));
        const j: { ok: boolean; bookings?: Array<{ booking_id: number; booking_date: string; time_start: string | null; status: string }>; error?: string } = await r.json();
        if (!j.ok) throw new Error(j.error || 'Failed to load user bookings');
        return j.bookings || [];
      };

      const todayBookings = await fetchBookings(fromToday, toToday);
      const statusMap: Record<string, ScheduleStatus> = { BOOKED: 'BOOKED', CHECKIN: 'IN_GYM', COMPLETED: 'OUT' };

      const inGym = todayBookings.find((b) => String(b.status).toUpperCase() === 'CHECKIN');
      if (inGym) {
        const hhmm = inGym.time_start || '00:00';
        const [h, m] = hhmm.split(':').map((x) => Number(x));
        const d = new Date(inGym.booking_date);
        d.setHours(h, m, 0, 0);
        return {
          id: String(inGym.booking_id),
          gym_user_id: userId!,
          schedule_time: d.toISOString(),
          status: 'IN_GYM',
          check_in_time: null,
          check_out_time: null,
          created_at: new Date().toISOString(),
        } as GymSchedule;
      }

      const weekBookings = await fetchBookings(weekFrom, weekTo);
      const now = new Date();
      const nextBooked = weekBookings
        .map((b) => {
          const hhmm = b.time_start || '00:00';
          const [h, m] = hhmm.split(':').map((x) => Number(x));
          const d = new Date(b.booking_date);
          d.setHours(h, m, 0, 0);
          return { b, dt: d };
        })
        .filter(({ b, dt }) => String(b.status).toUpperCase() === 'BOOKED' && dt.getTime() > now.getTime())
        .sort((a, b) => a.dt.getTime() - b.dt.getTime())[0];
      if (nextBooked) {
        const statusUpper = String(nextBooked.b.status).toUpperCase();
        const mappedStatus: ScheduleStatus = statusMap[statusUpper] ?? 'BOOKED';
        return {
          id: String(nextBooked.b.booking_id),
          gym_user_id: userId!,
          schedule_time: nextBooked.dt.toISOString(),
          status: mappedStatus,
          check_in_time: null,
          check_out_time: null,
          created_at: new Date().toISOString(),
        } as GymSchedule;
      }

      const lastOut = todayBookings
        .map((b) => {
          const hhmm = b.time_start || '00:00';
          const [h, m] = hhmm.split(':').map((x) => Number(x));
          const d = new Date(b.booking_date);
          d.setHours(h, m, 0, 0);
          return { b, dt: d };
        })
        .filter(({ b }) => String(b.status).toUpperCase() === 'COMPLETED')
        .sort((a, b) => b.dt.getTime() - a.dt.getTime())[0];
      if (lastOut) {
        return {
          id: String(lastOut.b.booking_id),
          gym_user_id: userId!,
          schedule_time: lastOut.dt.toISOString(),
          status: 'OUT',
          check_in_time: null,
          check_out_time: null,
          created_at: new Date().toISOString(),
        } as GymSchedule;
      }

      return null;
    },
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useAddSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (scheduleData: { gym_user_id: string; schedule_time: string }) => {
      const dt = new Date(scheduleData.schedule_time);
      const booking_date = format(dt, 'yyyy-MM-dd');
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      const session_id = `Session__${hh}:${mm}`;
      const resp = await fetch('/api/gym-booking-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-employee-id': scheduleData.gym_user_id },
        body: JSON.stringify({ employee_id: scheduleData.gym_user_id, session_id, booking_date }),
      }).catch(() => fetch('/gym-booking-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-employee-id': scheduleData.gym_user_id },
        body: JSON.stringify({ employee_id: scheduleData.gym_user_id, session_id, booking_date }),
      }));
      const json: { ok: boolean; booking_id?: number; schedule_id?: number; error?: string } = await resp.json();
      if (!json.ok || !json.booking_id) throw new Error(json.error || 'Failed to create booking');
      return {
        id: String(json.booking_id),
        gym_user_id: scheduleData.gym_user_id,
        schedule_time: dt.toISOString(),
        status: 'BOOKED',
        check_in_time: null,
        check_out_time: null,
        created_at: new Date().toISOString(),
      } as GymSchedule;
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
      const today = format(new Date(), 'yyyy-MM-dd');
      const r = await fetch(`/api/gym-bookings?from=${today}&to=${today}`).catch(() => fetch(`/gym-bookings?from=${today}&to=${today}`));
      const j: { ok: boolean; bookings?: Array<{ status: string }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load bookings');
      const currentCount = (j.bookings || []).filter((b) => String(b.status).toUpperCase() === 'CHECKIN').length;
      if (currentCount >= 15) throw new Error('GYM_FULL');
      const resp = await fetch('/api/gym-booking-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: Number(scheduleId), status: 'CHECKIN' }),
      }).catch(() => fetch('/gym-booking-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: Number(scheduleId), status: 'CHECKIN' }),
      }));
      const json: { ok: boolean; affected?: number; error?: string } = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to check in');
      const nowIso = new Date().toISOString();
      return { id: scheduleId, gym_user_id: '', schedule_time: nowIso, status: 'IN_GYM', check_in_time: nowIso, check_out_time: null, created_at: nowIso } as GymSchedule;
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
      const resp = await fetch('/api/gym-booking-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: Number(scheduleId), status: 'COMPLETED' }),
      }).catch(() => fetch('/gym-booking-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: Number(scheduleId), status: 'COMPLETED' }),
      }));
      const json: { ok: boolean; affected?: number; error?: string } = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to check out');
      const nowIso = new Date().toISOString();
      return { id: scheduleId, gym_user_id: '', schedule_time: nowIso, status: 'OUT', check_in_time: null, check_out_time: nowIso, created_at: nowIso } as GymSchedule;
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
      const resp = await fetch(`/api/gym-booking/${encodeURIComponent(scheduleId)}`, { method: 'DELETE' }).catch(() => fetch(`/gym-booking/${encodeURIComponent(scheduleId)}`, { method: 'DELETE' }));
      const json: { ok: boolean; affected?: number; error?: string } = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to delete booking');
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

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ scheduleId, schedule_time }: { scheduleId: string; schedule_time: string }) => {
      throw new Error('Update schedule not supported');
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gym-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['user-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['today-schedules-count'] });
      queryClient.invalidateQueries({ queryKey: ['next-schedule'] });
      toast({
        title: "Update Not Supported",
        description: `Changing booking time is not supported. Please delete and re-create.`,
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

export interface DashboardBooking {
  id: string;
  employee_id: string;
  employee_name: string | null;
  booking_date: string;
  time_start: string | null;
  status: ScheduleStatus;
  session_name?: string | null;
}

export function useTodayBookingStats(options?: { staleTime?: number; refetchInterval?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ['today-booking-stats'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const r = await fetch(`/api/gym-bookings?from=${today}&to=${today}`).catch(() => fetch(`/gym-bookings?from=${today}&to=${today}`));
      const j: { ok: boolean; bookings?: Array<{ status: string; approval_status?: string | null }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load bookings');
      const rows = j.bookings || [];
      const norm = (s: string | null | undefined) => String(s || '').toUpperCase();
      const stats = {
        booked: rows.filter((b) => norm(b.status) === 'BOOKED').length,
        checkin: rows.filter((b) => norm(b.status) === 'CHECKIN').length,
        completed: rows.filter((b) => norm(b.status) === 'COMPLETED').length,
        approved: rows.filter((b) => norm(b.approval_status) === 'APPROVED').length,
        rejected: rows.filter((b) => norm(b.approval_status) === 'REJECTED').length,
        pending: rows.filter((b) => norm(b.approval_status) === 'PENDING' || !norm(b.approval_status)).length,
        noShow: rows.filter((b) => ['EXPIRED','CANCELLED'].includes(norm(b.status))).length,
      };
      return stats;
    },
    staleTime: options?.staleTime ?? 30000,
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled ?? true,
  });
}

export function usePendingApprovalsList(limit: number = 5) {
  return useQuery({
    queryKey: ['pending-approvals', limit],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const r = await fetch(`/api/gym-bookings?from=${today}&to=${today}&approval_status=PENDING`).catch(() => fetch(`/gym-bookings?from=${today}&to=${today}&approval_status=PENDING`));
      const j: { ok: boolean; bookings?: Array<{ booking_id: number; employee_id: string; employee_name?: string; booking_date: string; time_start: string | null; status: string; session_name?: string }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load approvals');
      const rows = (j.bookings || []).slice(0, limit);
      const mapStatus: Record<string, ScheduleStatus> = { BOOKED: 'BOOKED', CHECKIN: 'IN_GYM', COMPLETED: 'OUT' };
      const data: DashboardBooking[] = rows.map((b) => ({
        id: String(b.booking_id),
        employee_id: String(b.employee_id || ''),
        employee_name: b.employee_name || null,
        booking_date: String(b.booking_date),
        time_start: b.time_start || null,
        status: mapStatus[String(b.status).toUpperCase()] || 'BOOKED',
        session_name: b.session_name || null,
      }));
      return data;
    },
    staleTime: 10000,
  });
}

export function useTodayBookingsSimple(limit: number = 8) {
  return useQuery({
    queryKey: ['today-bookings-simple', limit],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const r = await fetch(`/api/gym-bookings?from=${today}&to=${today}`).catch(() => fetch(`/gym-bookings?from=${today}&to=${today}`));
      const j: { ok: boolean; bookings?: Array<{ booking_id: number; employee_id: string; employee_name?: string; booking_date: string; time_start: string | null; status: string; session_name?: string }>; error?: string } = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed to load today bookings');
      const rows = (j.bookings || []).sort((a, b) => {
        const ta = (a.time_start || '00:00');
        const tb = (b.time_start || '00:00');
        return ta.localeCompare(tb);
      }).slice(0, limit);
      const mapStatus: Record<string, ScheduleStatus> = { BOOKED: 'BOOKED', CHECKIN: 'IN_GYM', COMPLETED: 'OUT' };
      const data: DashboardBooking[] = rows.map((b) => ({
        id: String(b.booking_id),
        employee_id: String(b.employee_id || ''),
        employee_name: b.employee_name || null,
        booking_date: String(b.booking_date),
        time_start: b.time_start || null,
        status: mapStatus[String(b.status).toUpperCase()] || 'BOOKED',
        session_name: b.session_name || null,
      }));
      return data;
    },
  });
}
