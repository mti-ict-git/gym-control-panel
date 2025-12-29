import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mock Vault data - in production, this would call external Vault API
const mockVaultUsers = [
  { employee_id: 'EMP001', name: 'Ahmad Rahman', department: 'Engineering', status: 'ACTIVE', card_no: 'CN001' },
  { employee_id: 'EMP002', name: 'Sarah Lee', department: 'Marketing', status: 'ACTIVE', card_no: 'CN002' },
  { employee_id: 'EMP003', name: 'Budi Santoso', department: 'Finance', status: 'ACTIVE', card_no: 'CN003' },
  { employee_id: 'EMP004', name: 'Maya Chen', department: 'HR', status: 'INACTIVE', card_no: 'CN004' },
  { employee_id: 'EMP005', name: 'Ravi Kumar', department: 'Engineering', status: 'ACTIVE', card_no: 'CN005' },
  { employee_id: 'EMP006', name: 'Lisa Wong', department: 'Operations', status: 'ACTIVE', card_no: 'CN006' },
  { employee_id: 'EMP007', name: 'John Smith', department: 'Sales', status: 'INACTIVE', card_no: 'CN007' },
  { employee_id: 'EMP008', name: 'Dewi Putri', department: 'Engineering', status: 'ACTIVE', card_no: 'CN008' },
  { employee_id: 'EMP009', name: 'Michael Tan', department: 'Finance', status: 'ACTIVE', card_no: 'CN009' },
  { employee_id: 'EMP010', name: 'Anita Sari', department: 'Marketing', status: 'ACTIVE', card_no: 'CN010' },
];

type VaultUserDto = {
  employee_id: string;
  name: string;
  department: string;
  status: 'ACTIVE' | 'INACTIVE';
  card_no?: string;
  session?: string;
};

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("Missing backend environment variables");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const JAKARTA_OFFSET_MINUTES = 7 * 60;
function startOfTodayJakartaUtcDate(): Date {
  const now = new Date();
  const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MINUTES * 60_000);
  return new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth(), jakartaNow.getUTCDate()));
}

function toJakartaTimeString(ts: string): string {
  const d = new Date(ts);
  const local = new Date(d.getTime() + JAKARTA_OFFSET_MINUTES * 60_000);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getAdminClient();

    // Window: tomorrow to next tomorrow (consistent with registration rules)
    const todayJakarta = startOfTodayJakartaUtcDate();
    const tomorrow = new Date(todayJakarta.getTime() + 24 * 60 * 60_000);
    const dayAfter = new Date(todayJakarta.getTime() + 2 * 24 * 60 * 60_000);
    const endOfDayAfter = new Date(dayAfter.getTime() + (24 * 60 * 60_000 - 1));

    const { data: schedules, error: schedErr } = await supabase
      .from("gym_schedules")
      .select("id, gym_user_id, schedule_time, status")
      .gte("schedule_time", tomorrow.toISOString())
      .lte("schedule_time", endOfDayAfter.toISOString())
      .eq("status", "BOOKED");

    if (schedErr) {
      return new Response(JSON.stringify({ users: mockVaultUsers, error: schedErr.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userIds = Array.from(new Set((schedules ?? []).map((s) => s.gym_user_id))).filter(Boolean);
    let gymUsers: Array<{ id: string; name: string; employee_id: string; department: string | null }> = [];
    if (userIds.length > 0) {
      const { data: gu, error: guErr } = await supabase
        .from("gym_users")
        .select("id, name, employee_id, department")
        .in("id", userIds);
      if (!guErr && gu) gymUsers = gu as Array<{ id: string; name: string; employee_id: string; department: string | null }>;
    }

    const { data: sessions, error: sessErr } = await supabase
      .from("gym_sessions")
      .select("id, session_name, time_start");

    const timeToSessionName = new Map<string, string>();
    for (const s of sessions ?? []) {
      // time_start format is HH:MM:SS; normalize to HH:MM
      const hhmm = String(s.time_start).slice(0, 5);
      timeToSessionName.set(hhmm, s.session_name);
    }

    // Compose registrations mapped to employee_id including session
    const gymUserById = new Map<string, (typeof gymUsers)[number]>();
    for (const u of gymUsers) gymUserById.set(u.id, u);

    const registeredUsers: VaultUserDto[] = (schedules ?? []).map((sc) => {
      const u = gymUserById.get(sc.gym_user_id);
      const timeStr = toJakartaTimeString(sc.schedule_time); // HH:MM
      const session = timeToSessionName.get(timeStr) ?? undefined;
      return u
        ? {
            employee_id: u.employee_id,
            name: u.name,
            department: u.department ?? "",
            status: "ACTIVE",
            card_no: undefined,
            session,
          }
        : null;
    }).filter(Boolean) as VaultUserDto[];

    // Merge mock vault users with registered users (prefer registered session info)
    const map = new Map<string, VaultUserDto>();
    for (const v of mockVaultUsers) map.set(v.employee_id, { ...v });
    for (const r of registeredUsers) {
      if (map.has(r.employee_id)) {
        map.set(r.employee_id, { ...map.get(r.employee_id), session: r.session ?? map.get(r.employee_id)?.session });
      } else {
        // Unknown in vault; still include as new row
        map.set(r.employee_id, { ...r, card_no: r.card_no ?? "" });
      }
    }

    const merged = Array.from(map.values());
    return new Response(JSON.stringify({ users: merged }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching vault users:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
