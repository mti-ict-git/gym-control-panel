import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JAKARTA_OFFSET_MINUTES = 7 * 60;

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("Missing backend environment variables");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseDateOnly(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  return { y, m, d };
}

function startOfTodayJakartaUtcDate(): Date {
  const now = new Date();
  // Convert current time to Jakarta wall-clock, then take its date component.
  const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MINUTES * 60_000);
  return new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth(), jakartaNow.getUTCDate()));
}

function buildScheduleTimeIso({ y, m, d }: { y: number; m: number; d: number }, timeStart: string): string | null {
  // timeStart expected like HH:MM:SS or HH:MM
  const parts = timeStart.split(":").map((v) => Number(v));
  const hour = parts[0];
  const minute = parts[1] ?? 0;
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  // Interpret input date+time as Jakarta local time, convert to UTC for timestamptz storage.
  const utcMillis = Date.UTC(y, m - 1, d, hour, minute, 0) - JAKARTA_OFFSET_MINUTES * 60_000;
  return new Date(utcMillis).toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const employeeId = String(body.employeeId ?? "").trim();
    const sessionId = String(body.sessionId ?? "").trim();
    const date = String(body.date ?? "").trim();

    if (!employeeId) {
      return new Response(JSON.stringify({ ok: false, error: "Employee ID is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (employeeId.length > 50) {
      return new Response(JSON.stringify({ ok: false, error: "Employee ID is too long" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!sessionId) {
      return new Response(JSON.stringify({ ok: false, error: "Session is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dateParts = parseDateOnly(date);
    if (!dateParts) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid date" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only allow tomorrow and the day after tomorrow (Jakarta time)
    const todayJakarta = startOfTodayJakartaUtcDate();
    const tomorrow = new Date(todayJakarta.getTime() + 24 * 60 * 60_000);
    const dayAfter = new Date(todayJakarta.getTime() + 2 * 24 * 60 * 60_000);
    const requested = new Date(Date.UTC(dateParts.y, dateParts.m - 1, dateParts.d));

    if (requested.getTime() < tomorrow.getTime() || requested.getTime() > dayAfter.getTime()) {
      return new Response(JSON.stringify({ ok: false, error: "Only tomorrow and next tomorrow are allowed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getAdminClient();

    const { data: user, error: userError } = await supabase
      .from("gym_users")
      .select("id")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (userError) {
      return new Response(JSON.stringify({ ok: false, error: userError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "Employee not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session, error: sessionError } = await supabase
      .from("gym_sessions")
      .select("id, session_name, time_start, quota")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      return new Response(JSON.stringify({ ok: false, error: sessionError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!session) {
      return new Response(JSON.stringify({ ok: false, error: "Session not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scheduleTimeIso = buildScheduleTimeIso(dateParts, session.time_start);
    if (!scheduleTimeIso) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid session time" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Duplicate booking check
    const { count: duplicateCount, error: dupError } = await supabase
      .from("gym_schedules")
      .select("id", { count: "exact", head: true })
      .eq("gym_user_id", user.id)
      .eq("schedule_time", scheduleTimeIso);

    if (dupError) {
      return new Response(JSON.stringify({ ok: false, error: dupError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((duplicateCount ?? 0) > 0) {
      return new Response(JSON.stringify({ ok: false, error: "You are already registered for this session" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Quota check: count existing bookings for the exact schedule_time
    const { count: bookingCount, error: bookingError } = await supabase
      .from("gym_schedules")
      .select("id", { count: "exact", head: true })
      .eq("schedule_time", scheduleTimeIso)
      .eq("status", "BOOKED");

    if (bookingError) {
      return new Response(JSON.stringify({ ok: false, error: bookingError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((bookingCount ?? 0) >= session.quota) {
      return new Response(JSON.stringify({ ok: false, error: "This session is full" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await supabase
      .from("gym_schedules")
      .insert({
        gym_user_id: user.id,
        schedule_time: scheduleTimeIso,
        status: "BOOKED",
      });

    if (insertError) {
      return new Response(JSON.stringify({ ok: false, error: insertError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, sessionName: session.session_name, schedule_time: scheduleTimeIso }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
