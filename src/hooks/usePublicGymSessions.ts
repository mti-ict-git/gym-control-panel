import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type SessionRow = Tables<"gym_sessions">;
export type PublicGymSession = Pick<SessionRow, "id" | "session_name" | "time_start" | "time_end" | "quota"> & {
  booked_count?: number;
};

export function usePublicGymSessionsList(date?: Date) {
  const dateStr = date ? format(date, "yyyy-MM-dd") : undefined;

  return useQuery({
    queryKey: ["public-gym-sessions", dateStr],
    queryFn: async (): Promise<PublicGymSession[]> => {
      const { data, error } = await supabase.functions.invoke("public-sessions", {
        body: { date: dateStr },
      });
      if (error) throw error;

      const payload = data as { ok: boolean; error?: string; sessions?: PublicGymSession[] } | null;
      if (!payload || !payload.ok) {
        throw new Error(payload?.error || "Failed to load sessions");
      }

      return Array.isArray(payload.sessions) ? payload.sessions : [];
    },
    staleTime: 60_000,
  });
}
