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
      const endpoint = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DB_TEST_ENDPOINT as string | undefined;
      const base = endpoint && endpoint.trim().length > 0 ? endpoint : '/api';
      const tryFetch = async (url: string): Promise<ResponsePayload> => {
        const r = await fetch(url);
        const j = (await r.json()) as ResponsePayload;
        if (r.status >= 500) throw new Error(j?.error || 'Server error');
        return j;
      };

      let json: ResponsePayload = null;
      try {
        json = await tryFetch(`${base}/gym-sessions`);
      } catch (_) {
        json = await tryFetch(`/gym-sessions`);
      }

      if (!json || !json.ok) throw new Error(json?.error || 'Failed to load GymDB sessions');
      return Array.isArray(json.sessions) ? json.sessions : [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    keepPreviousData: true,
  });
}

export interface GymDbSessionsPagedResult {
  rows: GymDbSession[];
  total: number;
}

export function useGymDbSessionsPaged(q: string, page: number, pageSize: number, sortBy?: 'session_name' | 'time_start' | 'time_end' | 'quota', sortDir: 'asc' | 'desc' = 'asc') {
  interface GymSessionsResponse { ok: boolean; sessions?: GymDbSession[]; total?: number; error?: string }
  return useQuery<GymDbSessionsPagedResult>({
    queryKey: ['gymdb-sessions-paged', q, page, pageSize, sortBy || '', sortDir],
    queryFn: async (): Promise<GymDbSessionsPagedResult> => {
      const endpoint = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DB_TEST_ENDPOINT as string | undefined;
      const base = endpoint && endpoint.trim().length > 0 ? endpoint : '/api';
      const tryFetch = async (url: string): Promise<GymSessionsResponse> => {
        const r = await fetch(url);
        const j = (await r.json()) as GymSessionsResponse;
        if (r.status >= 500) throw new Error(j?.error || 'Server error');
        return j;
      };

      const params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      if (sortBy) params.set('sort_by', sortBy);
      if (sortDir) params.set('sort_dir', sortDir);

      let json: GymSessionsResponse | null = null;
      try {
        json = await tryFetch(`${base}/gym-sessions?${params.toString()}`);
      } catch (_) {
        json = await tryFetch(`/gym-sessions?${params.toString()}`);
      }

      if (!json || !json.ok) throw new Error(json?.error || 'Failed to load GymDB sessions');
      const sessions = Array.isArray(json.sessions) ? json.sessions : [];
      const total = Number(json.total || sessions.length || 0);
      return { rows: sessions, total };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });
}
