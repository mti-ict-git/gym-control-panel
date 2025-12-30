import { useQuery } from '@tanstack/react-query';

export interface VaultUser {
  booking_id: number;
  schedule_time: string;
  time_start: string | null;
  time_end: string | null;
  employee_id: string;
  name: string;
  department: string | null;
  gender: string | null;
  status: 'BOOKED' | 'IN_GYM' | 'OUT';
  approval_status: string | null;
  card_no: string | null;
  booking_date: string;
}

const JAKARTA_OFFSET_MINUTES = 7 * 60;

function startOfTodayJakartaUtcDate(): Date {
  const now = new Date();
  const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MINUTES * 60_000);
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
  time_start: string | null;
};

type GymDbBookingResponse = { ok: boolean; error?: string; bookings?: GymDbBookingRow[] } | null;

function buildJakartaScheduleTimeIso(dateStr: string, hhmm: string): string | null {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateStr);
  const t = /^([0-9]{2}):([0-9]{2})$/.exec(hhmm);
  if (!m || !t) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(t[1]);
  const minute = Number(t[2]);
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute) - JAKARTA_OFFSET_MINUTES * 60_000);
  return utc.toISOString();
}

export function useVaultUsers() {
  return useQuery({
    queryKey: ['vault-users'],
    queryFn: async (): Promise<VaultUser[]> => {
      const endpoint = import.meta.env.VITE_DB_TEST_ENDPOINT as string | undefined;
      if (!endpoint) return [];

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

      const resp = await fetch(`${endpoint}/gym-bookings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const json = (await resp.json()) as GymDbBookingResponse;
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
  });
}
