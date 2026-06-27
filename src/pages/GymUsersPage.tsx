import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Activity, Download, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useGymLiveStatus, type LivePersonStatus } from '@/hooks/useGymLiveStatus';
import { useVaultUsers } from '@/hooks/useVaultUsers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type StatusFilter = 'ALL' | 'BOOKED' | 'IN_GYM' | 'LEFT';
type AccessFilter = 'ALL' | 'GRANTED' | 'NO_ACCESS';
type SortKey = 'name' | 'employee_id' | 'department' | 'status' | 'time_in' | 'time_out' | 'session';

const ALL = 'ALL';

const extractSessionName = (s: string | null): string => {
  const v = String(s || '').trim();
  if (!v) return '';
  const m = v.match(/^(.*?)(\s+\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2})$/);
  if (m) return m[1].trim();
  const parts = v.split(/\s+\d{1,2}:\d{2}/);
  return (parts[0] ? parts[0].trim() : v) || v;
};

// One canonical bucket per person: a session name, or Manager / Committee.
const sessionBucket = (schedule: string | null): string => {
  const name = extractSessionName(schedule).trim();
  if (!name) return 'Committee';
  const up = name.toUpperCase();
  if (up === 'MANAGER') return 'Manager';
  if (up === 'COMITTE' || up === 'COMMITTEE') return 'Committee';
  return name;
};

const sessionTime = (schedule: string | null): string => {
  const v = String(schedule || '').trim();
  const m = v.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (m) return `${m[1]}–${m[2]}`;
  const arr = v.match(/\d{1,2}:\d{2}/g);
  if (arr && arr.length >= 2) return `${arr[0]}–${arr[1]}`;
  return '';
};

const sessionColor = (bucket: string): string => {
  const lower = bucket.toLowerCase();
  if (lower.startsWith('morning')) return 'bg-green-100 text-green-700 border-green-200';
  if (lower.startsWith('afternoon')) return 'bg-blue-100 text-blue-700 border-blue-200';
  if (lower === 'manager') return 'bg-teal-100 text-teal-700 border-teal-200';
  if (lower.includes('evening')) return 'bg-purple-100 text-purple-700 border-purple-200';
  if (lower.includes('night') && lower.includes('1')) return 'bg-purple-100 text-purple-700 border-purple-200';
  if (lower.includes('night') && (lower.includes('2') || lower.includes('ramadhan'))) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (lower === 'committee') return 'bg-pink-100 text-pink-700 border-pink-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

export default function GymUsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data: liveStatus, isLoading: isLoadingStatus, isFetching, dataUpdatedAt, refetch } = useGymLiveStatus({ enabled: autoRefresh, refetchInterval: 2000 });
  const { data: vaultBookings } = useVaultUsers();
  const [sortBy, setSortBy] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const formatTimeUtc8 = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString([], { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const bookingMap = useMemo(() => {
    const map = new Map<string, { name: string; department: string | null }>();
    (vaultBookings || []).forEach((b) => {
      const emp = String(b.employee_id || '').trim();
      if (!emp) return;
      const name = String(b.name || '').trim();
      const dept = b.department != null ? String(b.department).trim() : '';
      const existing = map.get(emp);
      if (!existing) { map.set(emp, { name, department: dept || null }); return; }
      map.set(emp, { name: existing.name || name, department: existing.department || dept || null });
    });
    return map;
  }, [vaultBookings]);

  const enrichedLive = useMemo((): LivePersonStatus[] => {
    const list: LivePersonStatus[] = Array.isArray(liveStatus) ? liveStatus : [];
    return list.map((p) => {
      const emp = typeof p.employee_id === 'string' ? p.employee_id.trim() : '';
      const lookup = emp ? bookingMap.get(emp) : null;
      const name = typeof p.name === 'string' ? p.name.trim() : '';
      const department = typeof p.department === 'string' ? p.department.trim() : '';
      return {
        ...p,
        name: name || (lookup?.name ? lookup.name : null),
        department: department || (lookup?.department ? lookup.department : null),
      } satisfies LivePersonStatus;
    });
  }, [bookingMap, liveStatus]);

  // Absolute per-session counts (NOT inflated by committee) — used by the chips.
  const sessionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    enrichedLive.forEach((p) => {
      const b = sessionBucket(p.schedule);
      counts.set(b, (counts.get(b) || 0) + 1);
    });
    return counts;
  }, [enrichedLive]);

  const sessionChips = useMemo(() => {
    const rank = (name: string) => (name === 'Committee' ? 3 : name === 'Manager' ? 2 : 1);
    return Array.from(sessionCounts.entries()).sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
  }, [sessionCounts]);

  // Overview tiles reflect the whole of today (stable), the table reflects filters.
  const overview = useMemo(() => {
    return enrichedLive.reduce(
      (acc, p) => {
        acc.total += 1;
        if (p.status === 'IN_GYM') acc.inside += 1;
        if (p.status === 'BOOKED') acc.booked += 1;
        if (p.status === 'LEFT') acc.outside += 1;
        if (p.access_indicator.color === 'green') acc.granted += 1;
        if (p.access_indicator.color === 'red') acc.denied += 1;
        return acc;
      },
      { total: 0, inside: 0, booked: 0, outside: 0, granted: 0, denied: 0 },
    );
  }, [enrichedLive]);

  const filtered = useMemo((): LivePersonStatus[] => {
    const q = search.trim().toLowerCase();
    return enrichedLive.filter((p) => {
      if (sessionFilter !== ALL && sessionBucket(p.schedule) !== sessionFilter) return false;
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
  }, [accessFilter, enrichedLive, search, sessionFilter, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (sortBy === 'session') {
        const av = sessionTime(a.schedule) || sessionBucket(a.schedule);
        const bv = sessionTime(b.schedule) || sessionBucket(b.schedule);
        return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
      }
      if (sortBy === 'time_in' || sortBy === 'time_out') {
        const ak = a[sortBy];
        const bk = b[sortBy];
        const ad = typeof ak === 'string' && ak ? new Date(ak).getTime() : 0;
        const bd = typeof bk === 'string' && bk ? new Date(bk).getTime() : 0;
        return (ad - bd) * dir;
      }
      const av = String(a[sortBy] ?? '').toLowerCase();
      const bv = String(b[sortBy] ?? '').toLowerCase();
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) { setSortDir((p) => (p === 'asc' ? 'desc' : 'asc')); return; }
    setSortBy(key);
    setSortDir('asc');
  };
  const sortMark = (key: SortKey) => (sortBy === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');
  const sortHeadClass = (key: SortKey) => `cursor-pointer select-none ${sortBy === key ? 'text-foreground' : 'text-muted-foreground'}`;

  const resetFilters = () => {
    setSearch('');
    setSessionFilter(ALL);
    setStatusFilter('ALL');
    setAccessFilter('ALL');
  };
  const hasFilters = search !== '' || sessionFilter !== ALL || statusFilter !== 'ALL' || accessFilter !== 'ALL';

  const getDisplayName = (p: LivePersonStatus) => {
    const raw = typeof p.name === 'string' ? p.name.trim() : '';
    if (raw) return raw;
    const emp = typeof p.employee_id === 'string' ? p.employee_id.trim() : '';
    return emp || 'Unknown';
  };
  const getDisplayDepartment = (p: LivePersonStatus) => (typeof p.department === 'string' && p.department.trim()) || 'Unknown';

  const statusPill = (status: 'BOOKED' | 'IN_GYM' | 'LEFT') => {
    const cls = status === 'IN_GYM' ? 'border-green-200 bg-green-50 text-green-700'
      : status === 'LEFT' ? 'border-slate-200 bg-slate-50 text-slate-700'
      : 'border-yellow-200 bg-yellow-50 text-yellow-700';
    const label = status === 'IN_GYM' ? 'Inside' : status === 'LEFT' ? 'Outside' : 'Booked';
    return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${cls}`}>{label}</span>;
  };

  const accessPill = (color: 'green' | 'red', label: string) => (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${color === 'green' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
      <span className={`h-2 w-2 rounded-full ${color === 'green' ? 'bg-green-500' : 'bg-red-500'}`} />
      {label}
    </span>
  );

  const sessionChip = (schedule: string | null) => {
    const bucket = sessionBucket(schedule);
    const time = sessionTime(schedule);
    return (
      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${sessionColor(bucket)}`}>
        <span>{bucket}</span>
        {time ? <span className="opacity-70">· {time}</span> : null}
      </span>
    );
  };

  const tile = (label: string, value: number, accent: string) => (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );

  const exportCsv = () => {
    const headers = ['Name', 'Employee ID', 'Department', 'Session', 'Time', 'Time In', 'Time Out', 'Status', 'Access'];
    const rows = sorted.map((p) => [
      getDisplayName(p),
      String(p.employee_id ?? ''),
      getDisplayDepartment(p),
      sessionBucket(p.schedule),
      sessionTime(p.schedule),
      formatTimeUtc8(p.time_in),
      formatTimeUtc8(p.time_out),
      p.status === 'IN_GYM' ? 'Inside' : p.status === 'LEFT' ? 'Outside' : 'Booked',
      p.access_indicator.label,
    ]);
    const esc = (s: string) => '"' + String(s).replace(/"/g, '""') + '"';
    const csv = [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live_gym_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Activity className="h-5 w-5" />
              </span>
              Live Gym Monitoring
            </h1>
            <p className="text-muted-foreground mt-1">Status kehadiran & akses anggota gym secara real-time</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <Badge variant="secondary" className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
              {autoRefresh ? 'Live' : 'Paused'}
            </Badge>
            <span className="text-xs text-muted-foreground">Updated {format(new Date(dataUpdatedAt || Date.now()), 'HH:mm:ss')}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Auto</span>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} aria-label="Toggle auto refresh" />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        {/* Overview tiles (today) */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {tile('Total', overview.total, '')}
          {tile('Inside', overview.inside, 'text-green-600 dark:text-green-400')}
          {tile('Booked', overview.booked, 'text-yellow-600 dark:text-yellow-400')}
          {tile('Outside', overview.outside, 'text-slate-600 dark:text-slate-300')}
          {tile('Access OK', overview.granted, 'text-green-600 dark:text-green-400')}
          {tile('No Access', overview.denied, 'text-red-600 dark:text-red-400')}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / employee ID / department" className="pl-9" aria-label="Cari" />
              </div>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua status</SelectItem>
                    <SelectItem value="BOOKED">Booked</SelectItem>
                    <SelectItem value="IN_GYM">Inside</SelectItem>
                    <SelectItem value="LEFT">Outside</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={accessFilter} onValueChange={(v) => setAccessFilter(v as AccessFilter)}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua akses</SelectItem>
                    <SelectItem value="GRANTED">Granted</SelectItem>
                    <SelectItem value="NO_ACCESS">No Access</SelectItem>
                  </SelectContent>
                </Select>
                {hasFilters ? <Button variant="ghost" size="sm" onClick={resetFilters}>Reset</Button> : null}
              </div>
            </div>
            {/* Session filter chips with accurate per-session counts */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSessionFilter(ALL)}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium bg-slate-50 text-slate-700 border-slate-200 ${sessionFilter === ALL ? 'ring-2 ring-primary' : ''}`}
              >
                All <span className="font-semibold">{overview.total}</span>
              </button>
              {sessionChips.map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSessionFilter(name)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${sessionColor(name)} ${sessionFilter === name ? 'ring-2 ring-primary' : ''}`}
                >
                  {name} <span className="font-semibold">{count}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoadingStatus ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {sorted.length < 1 ? (
                <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">Tidak ada hasil.</div>
              ) : (
                sorted.map((p, idx) => (
                  <div
                    key={`${p.employee_id}-${p.time_in}-${idx}`}
                    className="rounded-xl border bg-card p-4 cursor-pointer shadow-sm"
                    onClick={() => p.employee_id && navigate(`/live_gym/${encodeURIComponent(String(p.employee_id))}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{getDisplayName(p)}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          <span>{p.employee_id ?? '-'}</span>
                          <span className="px-1">•</span>
                          <span className="truncate">{getDisplayDepartment(p)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {statusPill(p.status)}
                        {accessPill(p.access_indicator.color, p.access_indicator.label)}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {sessionChip(p.schedule)}
                      <span className="text-sm font-medium tabular-nums">
                        {formatTimeUtc8(p.time_in)} – {formatTimeUtc8(p.time_out)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-right">No</TableHead>
                    <TableHead className={sortHeadClass('name')} onClick={() => toggleSort('name')}>Name{sortMark('name')}</TableHead>
                    <TableHead className={sortHeadClass('employee_id')} onClick={() => toggleSort('employee_id')}>Employee ID{sortMark('employee_id')}</TableHead>
                    <TableHead className={sortHeadClass('department')} onClick={() => toggleSort('department')}>Department{sortMark('department')}</TableHead>
                    <TableHead className={sortHeadClass('session')} onClick={() => toggleSort('session')}>Session{sortMark('session')}</TableHead>
                    <TableHead className={sortHeadClass('time_in')} onClick={() => toggleSort('time_in')}>Time In{sortMark('time_in')}</TableHead>
                    <TableHead className={sortHeadClass('time_out')} onClick={() => toggleSort('time_out')}>Time Out{sortMark('time_out')}</TableHead>
                    <TableHead className={sortHeadClass('status')} onClick={() => toggleSort('status')}>Status{sortMark('status')}</TableHead>
                    <TableHead>Access</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.length < 1 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Tidak ada hasil.</TableCell>
                    </TableRow>
                  ) : (
                    sorted.map((p, idx) => (
                      <TableRow
                        key={`${p.employee_id}-${p.time_in}-${idx}`}
                        className={`cursor-pointer ${p.status === 'IN_GYM' ? 'bg-green-50/60 dark:bg-green-950/10' : p.status === 'BOOKED' ? 'bg-yellow-50/60 dark:bg-yellow-950/10' : ''}`}
                        onClick={() => p.employee_id && navigate(`/live_gym/${encodeURIComponent(String(p.employee_id))}`)}
                      >
                        <TableCell className="w-12 text-right text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{getDisplayName(p)}</TableCell>
                        <TableCell className="font-mono text-sm">{p.employee_id ?? '-'}</TableCell>
                        <TableCell>{getDisplayDepartment(p)}</TableCell>
                        <TableCell>{sessionChip(p.schedule)}</TableCell>
                        <TableCell className="font-mono tabular-nums">{formatTimeUtc8(p.time_in)}</TableCell>
                        <TableCell className="font-mono tabular-nums">{formatTimeUtc8(p.time_out)}</TableCell>
                        <TableCell>{statusPill(p.status)}</TableCell>
                        <TableCell>{accessPill(p.access_indicator.color, p.access_indicator.label)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
