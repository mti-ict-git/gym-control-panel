import { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Search } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useGymLiveStatus } from '@/hooks/useGymLiveStatus';

type SessionFilter = 'ALL' | 'COMITTE' | 'Morning' | 'Afternoon' | 'Night - 1' | 'Night - 2' | 'Other';
type StatusFilter = 'ALL' | 'BOOKED' | 'IN_GYM' | 'LEFT';
type AccessFilter = 'ALL' | 'GRANTED' | 'NO_ACCESS';

export default function GymUsersPage() {
  const [search, setSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('ALL');
  const { data: liveStatus, isLoading: isLoadingStatus } = useGymLiveStatus();

  const formatTimeUtc8 = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString(undefined, { timeZone: 'Asia/Singapore' });
  };

  const normalizeSession = (s: string | null): string => {
    const v = String(s || '').trim().toLowerCase();
    if (!v) return '';
    if (v.startsWith('morning')) return 'Morning';
    if (v.startsWith('afternoon')) return 'Afternoon';
    if (v.startsWith('night - 1') || v.startsWith('night-1') || v.startsWith('night 1') || v.startsWith('night1')) return 'Night - 1';
    if (v.startsWith('night - 2') || v.startsWith('night-2') || v.startsWith('night 2') || v.startsWith('night2')) return 'Night - 2';
    return (s || '').split(/\s+\d/)[0]?.trim() || (s || '');
  };

  const getSessionChip = (session: string | null) => {
    const s = String(session || '').trim();
    if (!s) return <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 border-slate-200">COMITTE</span>;
    const lower = s.toLowerCase();
    const color = lower.startsWith('morning')
      ? 'bg-green-100 text-green-700 border-green-200'
      : lower.startsWith('afternoon')
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : lower.includes('night') && lower.includes('1')
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : lower.includes('night') && lower.includes('2')
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
    return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${color}`}>{s}</span>;
  };

  const formatDateUtc8 = (isoIn: string | null, isoOut: string | null) => {
    const iso = isoIn || isoOut;
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(undefined, { timeZone: 'Asia/Singapore' });
  };

  const getTimeSchedule = (s: string | null): string => {
    const v = String(s || '').trim();
    if (!v) return 'COMITTE';
    const m = v.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
    const arr = v.match(/\d{1,2}:\d{2}/g);
    if (arr && arr.length >= 2) return `${arr[0]}-${arr[1]}`;
    return 'COMITTE';
  };

  const getScheduleChip = (schedule: string | null) => {
    const text = getTimeSchedule(schedule);
    const label = normalizeSession(schedule);
    const lower = label.toLowerCase();
    const color = lower.startsWith('morning')
      ? 'bg-green-100 text-green-700 border-green-200'
      : lower.startsWith('afternoon')
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : lower.includes('night') && lower.includes('1')
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : lower.includes('night') && lower.includes('2')
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
    return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${color}`}>{text}</span>;
  };

  const statusPill = (status: 'BOOKED' | 'IN_GYM' | 'LEFT') => {
    const cls =
      status === 'IN_GYM'
        ? 'border-green-200 bg-green-50 text-green-700'
        : status === 'LEFT'
        ? 'border-slate-200 bg-slate-50 text-slate-700'
        : 'border-yellow-200 bg-yellow-50 text-yellow-700';
    const label = status === 'IN_GYM' ? 'Inside' : status === 'LEFT' ? 'Outside' : 'Booked';
    return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${cls}`}>{label}</span>;
  };

  const getSessionCountChip = (name: string, count: number) => {
    const lower = name.toLowerCase();
    const color = lower.startsWith('morning')
      ? 'bg-green-100 text-green-700 border-green-200'
      : lower.startsWith('afternoon')
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : lower.includes('night') && lower.includes('1')
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : lower.includes('night') && lower.includes('2')
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
    return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${color}`}>{name}: {count}</span>;
  };

  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Morning': 0, 'Afternoon': 0, 'Night - 1': 0, 'Night - 2': 0, 'COMITTE': 0, 'Other': 0 };
    (liveStatus ?? []).forEach((p) => {
      const label = normalizeSession(p.schedule);
      if (label === '') counts['COMITTE']++;
      else if (label === 'Morning') counts['Morning']++;
      else if (label === 'Afternoon') counts['Afternoon']++;
      else if (label === 'Night - 1') counts['Night - 1']++;
      else if (label === 'Night - 2') counts['Night - 2']++;
      else counts['Other']++;
    });
    return counts;
  }, [liveStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = Array.isArray(liveStatus) ? liveStatus : [];
    return list.filter((p) => {
      const session = normalizeSession(p.schedule);
      const sessionBucket: SessionFilter =
        session === ''
          ? 'COMITTE'
          : session === 'Morning' || session === 'Afternoon' || session === 'Night - 1' || session === 'Night - 2'
            ? session
            : 'Other';
      if (sessionFilter !== 'ALL' && sessionBucket !== sessionFilter) return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (accessFilter === 'GRANTED' && p.access_indicator.color !== 'green') return false;
      if (accessFilter === 'NO_ACCESS' && p.access_indicator.color !== 'red') return false;
      if (!q) return true;

      const name = String(p.name ?? '').toLowerCase();
      const emp = String(p.employee_id ?? '').toLowerCase();
      const dept = String(p.department ?? '').toLowerCase();
      const sched = String(p.schedule ?? '').toLowerCase();
      return name.includes(q) || emp.includes(q) || dept.includes(q) || sched.includes(q);
    });
  }, [accessFilter, liveStatus, search, sessionFilter, statusFilter]);

  const accessPill = (color: 'green' | 'red', label: string) => {
    const cls = color === 'green' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700';
    return (
      <span className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium ${cls}`}
      >
        <span className={`h-2 w-2 rounded-full ${color === 'green' ? 'bg-green-500' : 'bg-red-500'}`} />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Live Gym Monitoring</h1>
          <p className="text-muted-foreground">Real-time overview of active gym members and access status.</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Today's Booking Date</div>
                <div className="text-lg font-semibold">{format(new Date(), 'yyyy-MM-dd')}</div>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-sm text-muted-foreground mb-2">Session & Count</div>
              <div className="flex flex-wrap gap-2">
                {getSessionCountChip('COMITTE', sessionCounts['COMITTE'])}
                {getSessionCountChip('Morning', sessionCounts['Morning'])}
                {getSessionCountChip('Afternoon', sessionCounts['Afternoon'])}
                {getSessionCountChip('Night - 1', sessionCounts['Night - 1'])}
                {getSessionCountChip('Night - 2', sessionCounts['Night - 2'])}
                {getSessionCountChip('Other', sessionCounts['Other'])}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 rounded-lg border bg-card p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name / employee id / department"
                  className="pl-9"
                  aria-label="Search live gym monitoring"
                />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-sm font-semibold">{filtered.length}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                'ALL',
                'COMITTE',
                'Morning',
                'Afternoon',
                'Night - 1',
                'Night - 2',
                'Other',
              ] as SessionFilter[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSessionFilter(v)}
                  className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${
                    sessionFilter === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground'
                  }`}
                  aria-pressed={sessionFilter === v}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                { label: 'All', value: 'ALL' },
                { label: 'Booked', value: 'BOOKED' },
                { label: 'Inside', value: 'IN_GYM' },
                { label: 'Outside', value: 'LEFT' },
              ] as Array<{ label: string; value: StatusFilter }>).map((x) => (
                <button
                  key={x.value}
                  type="button"
                  onClick={() => setStatusFilter(x.value)}
                  className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${
                    statusFilter === x.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground'
                  }`}
                  aria-pressed={statusFilter === x.value}
                >
                  {x.label}
                </button>
              ))}
              {([
                { label: 'All Access', value: 'ALL' },
                { label: 'Granted', value: 'GRANTED' },
                { label: 'No Access', value: 'NO_ACCESS' },
              ] as Array<{ label: string; value: AccessFilter }>).map((x) => (
                <button
                  key={x.value}
                  type="button"
                  onClick={() => setAccessFilter(x.value)}
                  className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${
                    accessFilter === x.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground'
                  }`}
                  aria-pressed={accessFilter === x.value}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          </div>
        </div>

        {isLoadingStatus ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="md:hidden space-y-3">
              {filtered.length < 1 ? (
                <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
                  No results.
                </div>
              ) : (
                filtered.map((p, idx) => {
                  const key = `${p.employee_id}-${p.time_in}-${idx}`;
                  const sessionLabel = normalizeSession(p.schedule);
                  return (
                    <div key={key} className="rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{p.name ?? '-'}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            <span>{p.employee_id ?? '-'}</span>
                            <span className="px-1">•</span>
                            <span className="truncate">{p.department ?? '-'}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {statusPill(p.status)}
                          {accessPill(p.access_indicator.color, p.access_indicator.label)}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-12 gap-2">
                        <div className="col-span-12 flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Session</span>
                          {getSessionChip(sessionLabel)}
                        </div>
                        <div className="col-span-12 flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Time Schedule</span>
                          {getScheduleChip(p.schedule)}
                        </div>

                        <div className="col-span-6">
                          <div className="text-xs text-muted-foreground">Date</div>
                          <div className="text-sm font-medium">{formatDateUtc8(p.time_in, p.time_out)}</div>
                        </div>
                        <div className="col-span-6">
                          <div className="text-xs text-muted-foreground">Time</div>
                          <div className="text-sm font-medium">
                            {formatTimeUtc8(p.time_in)} – {formatTimeUtc8(p.time_out)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden md:block rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-right">No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>ID Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Time Schedule</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Access</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p, idx) => (
                    <TableRow key={`${p.employee_id}-${p.time_in}-${idx}`}>
                      <TableCell className="w-12 text-right">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{p.name ?? '-'}</TableCell>
                      <TableCell>{p.employee_id ?? '-'}</TableCell>
                      <TableCell>{p.department ?? '-'}</TableCell>
                      <TableCell>{getSessionChip(normalizeSession(p.schedule))}</TableCell>
                      <TableCell>{getScheduleChip(p.schedule)}</TableCell>
                      <TableCell>{formatDateUtc8(p.time_in, p.time_out)}</TableCell>
                      <TableCell>{formatTimeUtc8(p.time_in)}</TableCell>
                      <TableCell>{formatTimeUtc8(p.time_out)}</TableCell>
                      <TableCell>{statusPill(p.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${p.access_indicator.color === 'green' ? 'bg-green-500' : 'bg-red-500'}`}
                          />
                          <span>{p.access_indicator.label}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
