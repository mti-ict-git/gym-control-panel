import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VaultUser {
  schedule_time: string;
  employee_id: string;
  name: string;
  department: string | null;
  status: 'BOOKED' | 'IN_GYM' | 'OUT';
  card_no: string | null;
}

type EmployeeCoreRow = {
  employee_id: string;
  name: string;
  department: string | null;
  card_no: string | null;
};

type EmployeeCoreResponse = { ok: boolean; employees?: EmployeeCoreRow[]; error?: string } | null;

type BookingScheduleRow = {
  id: string;
  schedule_time: string;
  status: VaultUser['status'] | string;
  gym_users: { employee_id: string | null } | null;
};

const JAKARTA_OFFSET_MINUTES = 7 * 60;

function startOfTodayJakartaUtcDate(): Date {
  const now = new Date();
  const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MINUTES * 60_000);
  return new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth(), jakartaNow.getUTCDate()));
}

export function useVaultUsers() {
  return useQuery({
    queryKey: ['vault-users'],
    queryFn: async (): Promise<VaultUser[]> => {
      const todayJakarta = startOfTodayJakartaUtcDate();
      const tomorrow = new Date(todayJakarta.getTime() + 24 * 60 * 60_000);
      const dayAfter = new Date(todayJakarta.getTime() + 2 * 24 * 60 * 60_000);
      const endOfDayAfter = new Date(dayAfter.getTime() + (24 * 60 * 60_000 - 1));

      const { data: schedules, error: schedErr } = await supabase
        .from('gym_schedules')
        .select(
          `
            id,
            schedule_time,
            status,
            gym_users (
              employee_id
            )
          `,
        )
        .gte('schedule_time', tomorrow.toISOString())
        .lte('schedule_time', endOfDayAfter.toISOString())
        .in('status', ['BOOKED', 'IN_GYM', 'OUT'])
        .order('schedule_time', { ascending: true });

      if (schedErr) throw schedErr;

      const rows: BookingScheduleRow[] = Array.isArray(schedules) ? (schedules as BookingScheduleRow[]) : [];
      const employeeIds = Array.from(
        new Set(
          rows.map((r) => String(r.gym_users?.employee_id || '').trim()).filter(Boolean),
        ),
      ).slice(0, 200);

      const endpoint = import.meta.env.VITE_DB_TEST_ENDPOINT as string | undefined;
      const employeeMap = new Map<string, EmployeeCoreRow>();

      if (endpoint && employeeIds.length > 0) {
        const resp = await fetch(`${endpoint}/employee-core?ids=${encodeURIComponent(employeeIds.join(','))}`);
        const json = (await resp.json()) as EmployeeCoreResponse;
        if (json?.ok && Array.isArray(json.employees)) {
          for (const e of json.employees) {
            employeeMap.set(String(e.employee_id).trim(), {
              employee_id: String(e.employee_id).trim(),
              name: String(e.name ?? '').trim(),
              department: e.department != null ? String(e.department).trim() : null,
              card_no: e.card_no != null ? String(e.card_no).trim() : null,
            });
          }
        }
      }

      return rows
        .map((r) => {
          const employee_id = String(r.gym_users?.employee_id || '').trim();
          if (!employee_id) return null;
          const emp = employeeMap.get(employee_id);
          return {
            schedule_time: String(r.schedule_time),
            employee_id,
            name: emp?.name || '',
            department: emp?.department ?? null,
            card_no: emp?.card_no ?? null,
            status: String(r.status) as VaultUser['status'],
          } satisfies VaultUser;
        })
        .filter(Boolean) as VaultUser[];
    },
    staleTime: 30_000,
  });
}
