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
      const tryFetch = async (url: string): Promise<ResponsePayload> => {
        const r = await fetch(url);
        const j = (await r.json()) as ResponsePayload;
        if (r.status >= 500) throw new Error(j?.error || 'Server error');
        return j;
      };

      let json: ResponsePayload = null;
      try {
        json = await tryFetch(`/api/gym-sessions`);
      } catch (_) {
        json = await tryFetch(`/gym-sessions`);
      }

      if (!json || !json.ok) throw new Error(json?.error || 'Failed to load GymDB sessions');
      return Array.isArray(json.sessions) ? json.sessions : [];
    },
    staleTime: 30_000,
  });
}
