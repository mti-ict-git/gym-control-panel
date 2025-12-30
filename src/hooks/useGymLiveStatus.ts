import { useQuery } from '@tanstack/react-query';

export type LivePersonStatus = {
  name: string | null;
  employee_id: string | null;
  department: string | null;
  schedule: string | null;
  time_in: string | null;
  time_out: string | null;
  status: 'BOOKED' | 'IN_GYM' | 'LEFT';
};

type LiveStatusResponse = { ok: boolean; error?: string; people?: LivePersonStatus[] } | null;

export function useGymLiveStatus() {
  return useQuery({
    queryKey: ['gym-live-status'],
    queryFn: async (): Promise<LivePersonStatus[]> => {
      const tryFetch = async (url: string): Promise<LiveStatusResponse> => {
        const r = await fetch(url);
        const j = (await r.json()) as LiveStatusResponse;
        if (r.status >= 500) throw new Error(j?.error || 'Server error');
        return j;
      };
      const endpoint = String(import.meta.env.VITE_BACKEND_URL || '').trim();
      const candidates: string[] = [];
      if (endpoint) {
        candidates.push(`${endpoint}/api/gym-live-status`);
        candidates.push(`${endpoint}/gym-live-status`);
      }
      candidates.push('/api/gym-live-status');
      candidates.push('/gym-live-status');
      let json: LiveStatusResponse = null;
      for (const url of candidates) {
        try {
          json = await tryFetch(url);
          break;
        } catch (_) { continue; }
      }
      if (!json || !json.ok) throw new Error(json?.error || 'Failed to load live status');
      return Array.isArray(json.people) ? json.people : [];
    },
    refetchInterval: 2000,
  });
}
