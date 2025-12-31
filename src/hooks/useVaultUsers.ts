import { useQuery } from '@tanstack/react-query';

export interface VaultUser {
  booking_id: number;
  schedule_time: string;
  time_start: string | null;
  time_end: string | null;
  session_name: string;
  employee_id: string;
  name: string;
  department: string | null;
  gender: string | null;
  status: 'BOOKED' | 'IN_GYM' | 'OUT';
  approval_status: string | null;
  card_no: string | null;
  booking_date: string;
}

const UTC8_OFFSET_MINUTES = 8 * 60;

function startOfTodayJakartaUtcDate(): Date {
  const now = new Date();
  const jakartaNow = new Date(now.getTime() + UTC8_OFFSET_MINUTES * 60_000);
  return new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth(), jakartaNow.getUTCDate()));
}

type GymDbBookingRow = {
  booking_id: number;
  employee_id: string;
  card_no: string | null;
  employee_name: string;
  department: string | null;
  gender: string | null;
  approval_status: string | null;
  booking_date: string;
  status: string;
  session_name: string | null;
  time_start: string | null;
  time_end: string | null;
};

type GymDbBookingResponse = { ok: boolean; error?: string; bookings?: GymDbBookingRow[]; total?: number } | null;

function buildJakartaScheduleTimeIso(dateStr: string, hhmm: string): string | null {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateStr);
  const t = /^([0-9]{2}):([0-9]{2})$/.exec(hhmm);
  if (!m || !t) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(t[1]);
  const minute = Number(t[2]);
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute) - UTC8_OFFSET_MINUTES * 60_000);
  return utc.toISOString();
}

export function useVaultUsers() {
  return useQuery({
    queryKey: ['vault-users'],
    queryFn: async (): Promise<VaultUser[]> => {
      const endpoint = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DB_TEST_ENDPOINT as string | undefined;
      const base = endpoint && endpoint.trim().length > 0 ? endpoint : '/api';
      const todayJakarta = startOfTodayJakartaUtcDate();
      const tomorrow = new Date(todayJakarta.getTime() + 24 * 60 * 60_000);
      const dayAfter = new Date(todayJakarta.getTime() + 2 * 24 * 60 * 60_000);

      const toYmd = (d: Date) => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };

      const from = toYmd(todayJakarta);
      const to = toYmd(dayAfter);


      const urlParams = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const tryFetch = async (url: string): Promise<GymDbBookingResponse> => {
        const r = await fetch(url);
        const j = (await r.json()) as GymDbBookingResponse;
        if (r.status >= 500) throw new Error(j?.error || 'Server error');
        return j;
      };

      let json: GymDbBookingResponse = null;
      try {
        json = await tryFetch(`${base}/gym-bookings?${urlParams}`);
      } catch (_) {
        json = await tryFetch(`/gym-bookings?${urlParams}`);
      }

      if (!json || !json.ok) throw new Error(json?.error || 'Failed to load GymDB bookings');

      const rows = Array.isArray(json.bookings) ? json.bookings : [];
      return rows
        .map((r) => {
          const schedule_time = r.time_start ? buildJakartaScheduleTimeIso(String(r.booking_date), String(r.time_start)) : null;
          if (!schedule_time) return null;
          const rawStatus = String(r.status || '').toUpperCase();
          const mappedStatus: VaultUser['status'] =
            rawStatus === 'BOOKED' ? 'BOOKED' : rawStatus === 'CHECKIN' ? 'IN_GYM' : 'OUT';

          const rawGender = r.gender != null ? String(r.gender).trim() : null;
          let mappedGender = rawGender;
          if (rawGender === 'M') mappedGender = 'Male';
          else if (rawGender === 'F') mappedGender = 'Female';

          return {
            booking_id: r.booking_id,
            schedule_time,
            time_start: r.time_start != null ? String(r.time_start).trim() : null,
            time_end: r.time_end != null ? String(r.time_end).trim() : null,
            session_name: r.session_name != null ? String(r.session_name).trim() : '-',
            employee_id: String(r.employee_id || '').trim(),
            name: String(r.employee_name || '').trim(),
            department: r.department != null ? String(r.department).trim() : null,
            gender: mappedGender,
            card_no: r.card_no != null ? String(r.card_no).trim() : null,
            approval_status: r.approval_status != null ? String(r.approval_status).trim() : null,
            status: mappedStatus,
            booking_date: r.booking_date,
          } satisfies VaultUser;
        })
        .filter(Boolean) as VaultUser[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
}

export interface VaultUsersPagedResult {
  rows: VaultUser[];
  total: number;
}

export function useVaultUsersPaged(params: {
  q: string;
  page: number;
  pageSize: number;
  status?: 'BOOKED' | 'CHECKIN' | 'COMPLETED';
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  sortBy?:
    | 'booking_id'
    | 'booking_date'
    | 'time_start'
    | 'time_end'
    | 'name'
    | 'employee_id'
    | 'department'
    | 'session'
    | 'status'
    | 'approval_status'
    | 'created_at';
  sortDir?: 'asc' | 'desc';
}) {
  const q = params.q;
  const page = params.page;
  const pageSize = params.pageSize;
  const status = params.status;
  const approvalStatus = params.approvalStatus;
  const sortBy = params.sortBy;
  const sortDir = params.sortDir || 'desc';

  return useQuery<VaultUsersPagedResult>({
    queryKey: ['vault-users-paged', q, page, pageSize, status || '', approvalStatus || '', sortBy || '', sortDir],
    queryFn: async (): Promise<VaultUsersPagedResult> => {
      const todayJakarta = startOfTodayJakartaUtcDate();
      const dayAfter = new Date(todayJakarta.getTime() + 2 * 24 * 60 * 60_000);

      const toYmd = (d: Date) => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };

      const from = toYmd(todayJakarta);
      const to = toYmd(dayAfter);

      const urlParams = new URLSearchParams();
      urlParams.set('from', from);
      urlParams.set('to', to);
      urlParams.set('page', String(page));
      urlParams.set('limit', String(pageSize));
      if (q) urlParams.set('q', q);
      if (status) urlParams.set('status', status);
      if (approvalStatus) urlParams.set('approval_status', approvalStatus);
      if (sortBy) urlParams.set('sort_by', sortBy);
      if (sortDir) urlParams.set('sort_dir', sortDir);

      const endpoint = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DB_TEST_ENDPOINT as string | undefined;
      const base = endpoint && endpoint.trim().length > 0 ? endpoint : '/api';
      const tryFetch = async (url: string): Promise<GymDbBookingResponse> => {
        const r = await fetch(url);
        const j = (await r.json()) as GymDbBookingResponse;
        if (r.status >= 500) throw new Error(j?.error || 'Server error');
        return j;
      };

      let json: GymDbBookingResponse = null;
      try {
        json = await tryFetch(`${base}/gym-bookings?${urlParams.toString()}`);
      } catch (_) {
        json = await tryFetch(`/gym-bookings?${urlParams.toString()}`);
      }

      if (!json || !json.ok) throw new Error(json?.error || 'Failed to load GymDB bookings');

      const rows = Array.isArray(json.bookings) ? json.bookings : [];
      const mapped = rows
        .map((r) => {
          const schedule_time = r.time_start ? buildJakartaScheduleTimeIso(String(r.booking_date), String(r.time_start)) : null;
          if (!schedule_time) return null;

          const rawStatus = String(r.status || '').toUpperCase();
          const mappedStatus: VaultUser['status'] =
            rawStatus === 'BOOKED' ? 'BOOKED' : rawStatus === 'CHECKIN' ? 'IN_GYM' : 'OUT';

          const rawGender = r.gender != null ? String(r.gender).trim() : null;
          let mappedGender = rawGender;
          if (rawGender === 'M') mappedGender = 'Male';
          else if (rawGender === 'F') mappedGender = 'Female';

          return {
            booking_id: r.booking_id,
            schedule_time,
            time_start: r.time_start != null ? String(r.time_start).trim() : null,
            time_end: r.time_end != null ? String(r.time_end).trim() : null,
            session_name: r.session_name != null ? String(r.session_name).trim() : '-',
            employee_id: String(r.employee_id || '').trim(),
            name: String(r.employee_name || '').trim(),
            department: r.department != null ? String(r.department).trim() : null,
            gender: mappedGender,
            card_no: r.card_no != null ? String(r.card_no).trim() : null,
            approval_status: r.approval_status != null ? String(r.approval_status).trim() : null,
            status: mappedStatus,
            booking_date: r.booking_date,
          } satisfies VaultUser;
        })
        .filter(Boolean) as VaultUser[];

      const total = Number(json.total || 0);
      return { rows: mapped, total };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
}
