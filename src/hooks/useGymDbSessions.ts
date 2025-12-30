import { useQuery } from '@tanstack/react-query';

export interface GymDbSession {
  session_name: string;
  time_start: string; // HH:MM
  time_end: string | null; // HH:MM or null
  quota: number;
}

type ResponsePayload = { ok: boolean; error?: string; sessions?: GymDbSession[] } | null;

export function useGymDbSessions() {
  return useQuery({
    queryKey: ['gymdb-sessions'],
    queryFn: async (): Promise<GymDbSession[]> => {
      const resp = await fetch(`/api/gym-sessions`);
      const json = (await resp.json()) as ResponsePayload;
      if (!json || !json.ok) throw new Error(json?.error || 'Failed to load GymDB sessions');
      return Array.isArray(json.sessions) ? json.sessions : [];
    },
    staleTime: 30_000,
  });
}
