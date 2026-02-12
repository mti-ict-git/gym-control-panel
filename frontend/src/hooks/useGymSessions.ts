import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface GymSession {
  id: string;
  schedule_id?: number;
  session_name: string;
  time_start: string;
  time_end: string;
  quota: number;
  created_at: string;
  updated_at: string;
}

export type GymSessionInsert = {
  session_name: string;
  time_start: string;
  time_end: string;
  quota: number;
};

export type GymSessionUpdate = {
  id: string;
  session_name?: string;
  time_start?: string;
  time_end?: string;
  quota?: number;
};

export function useGymSessionsList() {
  return useQuery({
    queryKey: ['gym-sessions-list'],
    queryFn: async () => {
      const resp = await fetch('/api/gym-sessions').catch(() => fetch('/gym-sessions'));
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load sessions');
      const sessions = (json.sessions || []).map((s: { schedule_id?: number; session_name: string; time_start: string; time_end: string | null; quota: number }, idx: number) => ({
        id: `gymdb-${s.session_name}-${s.time_start}-${idx}`,
        schedule_id: Number(s.schedule_id || 0) || undefined,
        session_name: s.session_name,
        time_start: s.time_start,
        time_end: s.time_end ?? s.time_start,
        quota: s.quota,
        created_at: '',
        updated_at: '',
      }));
      return sessions as GymSession[];
    },
  });
}

export function useCreateGymSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (session: GymSessionInsert) => {
      const resp = await fetch('/api/gym-session-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_name: session.session_name,
          time_start: session.time_start,
          time_end: session.time_end,
          quota: session.quota,
        }),
      }).catch(() => fetch('/gym-session-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      }));
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to create session');
      return {
        id: `gymdb-${session.session_name}-${session.time_start}`,
        session_name: session.session_name,
        time_start: session.time_start,
        time_end: session.time_end,
        quota: session.quota,
        created_at: '',
        updated_at: '',
      } as GymSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-sessions-list'] });
    },
  });
}

export function useUpdateGymSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: GymSessionUpdate) => {
      const original = parseIdToOriginal(id);
      const payload = {
        original_session_name: original.session_name,
        original_time_start: original.time_start,
        session_name: updates.session_name ?? original.session_name,
        time_start: updates.time_start ?? original.time_start,
        time_end: updates.time_end ?? original.time_start,
        quota: updates.quota ?? 0,
      };
      const resp = await fetch('/api/gym-session-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => fetch('/gym-session-update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to update session');
      return {
        id,
        session_name: payload.session_name,
        time_start: payload.time_start,
        time_end: payload.time_end ?? payload.time_start,
        quota: payload.quota,
        created_at: '',
        updated_at: '',
      } as GymSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-sessions-list'] });
    },
  });
}

export function useDeleteGymSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const original = parseIdToOriginal(id);
      const resp = await fetch('/api/gym-session-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_name: original.session_name, time_start: original.time_start }),
      }).catch(() => fetch('/gym-session-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_name: original.session_name, time_start: original.time_start }) }));
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to delete session');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-sessions-list'] });
    },
  });
}

function parseIdToOriginal(id: string): { session_name: string; time_start: string } {
  const m = id.match(/^gymdb-(.+)-(\d{2}:\d{2})/);
  if (m) {
    return { session_name: m[1], time_start: m[2] };
  }
  return { session_name: '', time_start: '' };
}

export function formatTime(time: string): string {
  // time is in HH:MM:SS format, convert to HH:MM AM/PM
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}
