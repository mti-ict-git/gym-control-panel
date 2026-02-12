import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export type PublicGymSession = {
  id: string;
  session_name: string;
  time_start: string;
  time_end: string | null;
  quota: number;
  booked_count?: number;
};

export function usePublicGymSessionsList(date?: Date) {
  const dateStr = date ? format(date, "yyyy-MM-dd") : undefined;

  return useQuery({
    queryKey: ["public-gym-sessions", dateStr],
    queryFn: async (): Promise<PublicGymSession[]> => {
      // Fetch sessions from GymDB
      const sessionsResp = await fetch(`/api/gym-sessions`).catch(() => fetch(`/gym-sessions`));
      const sessionsJson = (await sessionsResp.json()) as { ok: boolean; sessions?: Array<{ session_name: string; time_start: string; time_end: string | null; quota: number }>; error?: string } | null;
      if (!sessionsJson || !sessionsJson.ok) throw new Error(sessionsJson?.error || "Failed to load sessions");
      const baseSessions = (sessionsJson.sessions || []).map((s, idx) => ({
        id: `${s.session_name}-${s.time_start}-${idx}`,
        session_name: s.session_name,
        time_start: s.time_start,
        time_end: s.time_end,
        quota: s.quota,
        booked_count: 0,
      }));

      if (!dateStr) return baseSessions;

      // Fetch availability for booked counts
      const availResp = await fetch(`/api/gym-availability?date=${encodeURIComponent(dateStr)}`).catch(() => fetch(`/gym-availability?date=${encodeURIComponent(dateStr)}`));
      const availJson = (await availResp.json()) as { ok: boolean; availability?: Record<string, { booked_count: number; quota: number }>; error?: string } | null;
      const availability = (availJson && availJson.ok && availJson.availability) ? availJson.availability : {};

      return baseSessions.map((s) => {
        const key = s.time_start;
        const a = availability[key];
        return { ...s, booked_count: a ? Number(a.booked_count || 0) : 0 };
      });
    },
    staleTime: 60_000,
  });
}
