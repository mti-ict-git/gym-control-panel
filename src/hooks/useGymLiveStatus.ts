import { useQuery } from '@tanstack/react-query';

export type LivePersonStatus = {
  name: string | null;
  employee_id: string | null;
  department: string | null;
  schedule: string | null;
  time_in: string | null;
  time_out: string | null;
  status: 'BOOKED' | 'IN_GYM' | 'LEFT';
  access_required: boolean;
  access_granted: boolean;
  access_indicator: { color: 'green' | 'red'; label: string };
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
      const candidates: string[] = [];
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
      const people = Array.isArray(json.people) ? json.people : [];
      return people.map((p) => {
        const obj = p as Partial<LivePersonStatus>;
        const rawAi = obj.access_indicator as LivePersonStatus['access_indicator'] | undefined;
        const fallbackColor: LivePersonStatus['access_indicator']['color'] = obj.access_granted === true ? 'green' : 'red';
        const access_indicator = {
          color: rawAi?.color === 'green' || rawAi?.color === 'red' ? rawAi.color : fallbackColor,
          label:
            typeof rawAi?.label === 'string' && rawAi.label.trim().length > 0
              ? rawAi.label
              : fallbackColor === 'green'
                ? 'Granted'
                : 'No Access',
        } satisfies LivePersonStatus['access_indicator'];
        return {
          name: obj.name ?? null,
          employee_id: obj.employee_id ?? null,
          department: obj.department ?? null,
          schedule: obj.schedule ?? null,
          time_in: obj.time_in ?? null,
          time_out: obj.time_out ?? null,
          status: obj.status === 'IN_GYM' || obj.status === 'BOOKED' || obj.status === 'LEFT' ? obj.status : 'LEFT',
          access_required: Boolean(obj.access_required),
          access_granted: Boolean(obj.access_granted),
          access_indicator,
        } satisfies LivePersonStatus;
      });
    },
    refetchInterval: 2000,
  });
}
