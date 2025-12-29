import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function parseDateOnly(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split("-").map((v) => Number(v));
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  return { y, m, d };
}

function buildScheduleTimeIso({ y, m, d }: { y: number; m: number; d: number }, timeStart: string): string | null {
  const parts = timeStart.split(":").map((v) => Number(v));
  const hour = parts[0];
  const minute = parts[1] ?? 0;
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const utcMillis = Date.UTC(y, m - 1, d, hour, minute, 0) - JAKARTA_OFFSET_MINUTES * 60_000;
  return new Date(utcMillis).toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dateStr = String(body.date ?? "").trim();
    
    const supabase = getAdminClient();
    const { data: sessions, error } = await supabase
      .from("gym_sessions")
      .select("id, session_name, time_start, time_end, quota")
      .order("time_start", { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message, sessions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sessionsWithCounts = sessions ?? [];

    if (dateStr) {
      const dateParts = parseDateOnly(dateStr);
      if (dateParts) {
        // Calculate timestamps for all sessions
        const timestampsToCheck: string[] = [];
        const sessionTimeMap = new Map<string, string>(); // sessionId -> timestamp

        for (const s of sessionsWithCounts) {
          const ts = buildScheduleTimeIso(dateParts, s.time_start);
          if (ts) {
            timestampsToCheck.push(ts);
            sessionTimeMap.set(s.id, ts);
          }
        }

        if (timestampsToCheck.length > 0) {
           // Get counts for these timestamps
           // We can't easily do a single "count by group" with basic Supabase client easily unless we use rpc or raw query.
           // But since we have timestamps, we can query gym_schedules where schedule_time in (...) and status='BOOKED'
           // Then client-side group them.
           
           const { data: bookings, error: bookingError } = await supabase
             .from("gym_schedules")
             .select("schedule_time")
             .in("schedule_time", timestampsToCheck)
             .eq("status", "BOOKED");
             
           if (!bookingError && bookings) {
             const bookingCounts = new Map<string, number>(); // timestamp -> count
             for (const b of bookings) {
               const t = b.schedule_time;
               bookingCounts.set(t, (bookingCounts.get(t) || 0) + 1);
             }
             
             sessionsWithCounts = sessionsWithCounts.map(s => {
               const ts = sessionTimeMap.get(s.id);
               const count = ts ? (bookingCounts.get(ts) || 0) : 0;
               return { ...s, booked_count: count };
             });
           }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sessions: sessionsWithCounts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: message, sessions: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
