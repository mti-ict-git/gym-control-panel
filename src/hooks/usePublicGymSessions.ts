import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type SessionRow = Tables<"gym_sessions">;
export type PublicGymSession = Pick<SessionRow, "id" | "session_name" | "time_start" | "time_end" | "quota">;

export function usePublicGymSessionsList() {
  return useQuery({
    queryKey: ["public-gym-sessions"],
    queryFn: async (): Promise<PublicGymSession[]> => {
      const { data, error } = await supabase.functions.invoke("public-sessions");
      if (error) throw error;

      const payload = data as any;
      if (!payload?.ok) {
        throw new Error(payload?.error || "Failed to load sessions");
      }

      return (payload.sessions ?? []) as PublicGymSession[];
    },
    staleTime: 60_000,
  });
}
