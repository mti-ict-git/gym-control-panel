import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Search, Activity, Download, RefreshCw } from 'lucide-react';
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

type SessionFilter = string;
type StatusFilter = 'ALL' | 'BOOKED' | 'IN_GYM' | 'LEFT';
type AccessFilter = 'ALL' | 'GRANTED' | 'NO_ACCESS';

export default function GymUsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const allSessionValue = 'ALL';
  const committeeLabel = 'COMITTE';
  const managerLabel = 'MANAGER';
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>(allSessionValue);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data: liveStatus, isLoading: isLoadingStatus, isFetching, dataUpdatedAt } = useGymLiveStatus({ enabled: autoRefresh, refetchInterval: 2000 });
  const { data: vaultBookings } = useVaultUsers();
  const [sortBy, setSortBy] = useState<'name' | 'employee_id' | 'department' | 'status' | 'time_in' | 'time_out' | 'schedule'>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const formatTimeUtc8 = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString(undefined, { timeZone: 'Asia/Singapore' });
  };

  const extractSessionName = (s: string | null): string => {
    const v = String(s || '').trim();
    if (!v) return '';
    const m = v.match(/^(.*?)(\s+\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2})$/);
    if (m) return m[1].trim();
    const parts = v.split(/\s+\d{1,2}:\d{2}/);
    const base = parts[0] ? parts[0].trim() : v;
    return base || v;
  };

  const getSessionChip = (schedule: string | null) => {
    const s = extractSessionName(schedule);
    if (!s) return <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium bg-pink-100 text-pink-700 border-pink-200">{committeeLabel}</span>;
    const lower = s.toLowerCase();
    const color = lower.startsWith('morning')
      ? 'bg-green-100 text-green-700 border-green-200'
      : lower.startsWith('afternoon')
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : lower === 'manager'
      ? 'bg-teal-100 text-teal-700 border-teal-200'
      : lower.includes('evening')
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : lower.includes('night') && lower.includes('1')
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : lower.includes('night') && (lower.includes('2') || lower.includes('ramadhan'))
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : lower === 'comitte'
      ? 'bg-pink-100 text-pink-700 border-pink-200'
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
    if (v.toUpperCase() === managerLabel) return managerLabel;
    const m = v.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
    const arr = v.match(/\d{1,2}:\d{2}/g);
    if (arr && arr.length >= 2) return `${arr[0]}-${arr[1]}`;
    return 'COMITTE';
  };

  const getScheduleChip = (schedule: string | null) => {
    const text = getTimeSchedule(schedule);
    const label = extractSessionName(schedule);
    const lower = label.toLowerCase();
    const color = lower.startsWith('morning')
      ? 'bg-green-100 text-green-700 border-green-200'
      : lower.startsWith('afternoon')
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : lower === 'manager'
      ? 'bg-teal-100 text-teal-700 border-teal-200'
      : lower.includes('evening')
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : lower.includes('night') && lower.includes('1')
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : lower.includes('night') && (lower.includes('2') || lower.includes('ramadhan'))
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : !lower || lower === 'comitte'
      ? 'bg-pink-100 text-pink-700 border-pink-200'
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
      : lower === 'manager'
      ? 'bg-teal-100 text-teal-700 border-teal-200'
      : lower.includes('evening')
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : lower.includes('night') && lower.includes('1')
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : lower.includes('night') && (lower.includes('2') || lower.includes('ramadhan'))
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
    return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${color}`}>{name}: {count}</span>;
  };

  const bookingMap = useMemo(() => {
    const map = new Map<string, { name: string; department: string | null }>();
    (vaultBookings || []).forEach((b) => {
      const emp = String(b.employee_id || '').trim();
      if (!emp) return;
      const name = String(b.name || '').trim();
      const dept = b.department != null ? String(b.department).trim() : '';
      const existing = map.get(emp);
      if (!existing) {
        map.set(emp, { name, department: dept || null });
        return;
      }
      const nextName = existing.name || name;
      const nextDept = existing.department || dept || null;
      map.set(emp, { name: nextName, department: nextDept });
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

  const sessionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (enrichedLive ?? []).forEach((p) => {
      const label = extractSessionName(p.schedule);
      const key = label || committeeLabel;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [committeeLabel, enrichedLive]);

  const sessionOptions = useMemo(() => {
    const labels = Array.from(sessionCounts.keys());
    const hasCommittee = labels.includes(committeeLabel);
    const regular = labels.filter((l) => l && l !== committeeLabel).sort((a, b) => a.localeCompare(b));
    const tail = hasCommittee ? [committeeLabel] : [];
    return [allSessionValue, ...regular, ...tail];
  }, [allSessionValue, committeeLabel, sessionCounts]);

  const sessionCountEntries = useMemo(() => {
    const entries = Array.from(sessionCounts.entries()).filter(([name]) => name && name !== committeeLabel);
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    const committeeCount = sessionCounts.get(committeeLabel) || 0;
    return { entries, committeeCount };
  }, [committeeLabel, sessionCounts]);

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(key);
    setSortDir('asc');
  };

  const headerSortLabel = (key: typeof sortBy) => (sortBy === key ? (sortDir === 'asc' ? '↑' : '↓') : '');

  const sortableHeadClass = (key: typeof sortBy) =>
    `cursor-pointer select-none ${sortBy === key ? 'text-foreground' : 'text-muted-foreground'}`;

  const filtered = useMemo((): LivePersonStatus[] => {
    const q = search.trim().toLowerCase();
    const list: LivePersonStatus[] = Array.isArray(enrichedLive) ? enrichedLive : [];
    return list.filter((p) => {
      const session = extractSessionName(p.schedule);
      const sessionBucket = session === '' ? committeeLabel : session;
      if (sessionFilter !== allSessionValue && sessionBucket !== sessionFilter && sessionBucket !== committeeLabel) return false;
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
    const arr: LivePersonStatus[] = [...filtered];
    const key = sortBy;
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (key === 'schedule') {
        const av = String(getTimeSchedule(a.schedule)).toLowerCase();
        const bv = String(getTimeSchedule(b.schedule)).toLowerCase();
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      }
      const ak = a[key as keyof LivePersonStatus];
      const bk = b[key as keyof LivePersonStatus];
      const av = String(ak ?? '').toLowerCase();
      const bv = String(bk ?? '').toLowerCase();
      if (key === 'time_in' || key === 'time_out') {
        const ad = typeof ak === 'string' && ak ? new Date(ak).getTime() : 0;
        const bd = typeof bk === 'string' && bk ? new Date(bk).getTime() : 0;
        return (ad - bd) * dir;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const stats = useMemo(() => {
    const base = Array.isArray(filtered) ? filtered : [];
    return base.reduce(
      (acc, p) => {
        acc.total += 1;
        if (p.status === 'IN_GYM') acc.inside += 1;
        if (p.status === 'BOOKED') acc.booked += 1;
        if (p.status === 'LEFT') acc.outside += 1;
        if (p.access_indicator.color === 'green') acc.accessGranted += 1;
        if (p.access_indicator.color === 'red') acc.accessDenied += 1;
        return acc;
      },
      { total: 0, inside: 0, booked: 0, outside: 0, accessGranted: 0, accessDenied: 0 },
    );
  }, [filtered]);

  const resetFilters = () => {
    setSearch('');
    setSessionFilter(allSessionValue);
    setStatusFilter('ALL');
    setAccessFilter('ALL');
  };

  const sessionCountButton = (name: string, count: number, selected: boolean, onClick: () => void) => {
    const lower = name.toLowerCase();
    const base = lower.startsWith('morning')
      ? 'border-green-200 bg-green-50 text-green-700'
      : lower.startsWith('afternoon')
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : lower === 'manager'
      ? 'border-teal-200 bg-teal-50 text-teal-700'
      : lower.includes('night') && lower.includes('1')
      ? 'border-purple-200 bg-purple-50 text-purple-700'
      : lower.includes('night') && lower.includes('2')
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';
    const active = selected ? 'ring-2 ring-primary' : '';
    return (
      <button type="button" onClick={onClick} className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${base} ${active}`}>
        <span className="mr-1">{name}:</span>
        <span className="font-semibold">{count}</span>
      </button>
    );
  };

  const exportCsv = () => {
    const headers = ['Name','Employee ID','Department','Session','Schedule','Date','Time In','Time Out','Status','Access'];
    const rows = sorted.map((p) => [
      String(getDisplayName(p)),
      String(p.employee_id ?? ''),
      String(getDisplayDepartment(p)),
      String(extractSessionName(p.schedule) || committeeLabel),
      String(getTimeSchedule(p.schedule)),
      String(formatDateUtc8(p.time_in, p.time_out)),
      String(formatTimeUtc8(p.time_in)),
      String(formatTimeUtc8(p.time_out)),
      String(p.status),
      String(p.access_indicator.label),
    ]);
    const escapeCell = (s: string) => '"' + s.replace(/"/g, '""') + '"';
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live_gym_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  const getDisplayName = (p: LivePersonStatus) => {
    const raw = typeof p.name === 'string' ? p.name.trim() : '';
    if (raw) return raw;
    const emp = typeof p.employee_id === 'string' ? p.employee_id.trim() : '';
    return emp || 'Unknown';
  };

  const getDisplayDepartment = (p: LivePersonStatus) => {
    const raw = typeof p.department === 'string' ? p.department.trim() : '';
    return raw || 'Unknown';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 md:-mb-6">
          <Card className="flex w-full flex-col rounded-none md:min-h-[calc(100svh-3.5rem)] md:rounded-xl md:rounded-t-none md:border-t-0">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-semibold flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Activity className="h-5 w-5" />
                    </span>
                    Live Gym Monitoring
                  </CardTitle>
                  <CardDescription>Real-time overview of active gym members and access status.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="inline-flex items-center gap-1">
                    <Activity className="h-3 w-3 text-green-600" />
                    Live
                  </Badge>
                  {isFetching ? <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-label="Fetching" /> : null}
                  <span className="text-xs text-muted-foreground">Updated {format(new Date(dataUpdatedAt || Date.now()), 'HH:mm:ss')}</span>
                  <div className="flex items-center gap-2 pl-2">
                    <span className="text-xs text-muted-foreground">Auto</span>
                    <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} aria-label="Toggle auto refresh" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-4">
                  <div className="rounded-xl border bg-card shadow-sm p-4 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <CalendarIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Today's Booking Date</div>
                        <div className="text-lg font-semibold">{format(new Date(), 'yyyy-MM-dd')}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="text-xl font-semibold">{stats.total}</div>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Inside</div>
                        <div className="text-xl font-semibold">{stats.inside}</div>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Booked</div>
                        <div className="text-xl font-semibold">{stats.booked}</div>
                      </div>
                      <div className="rounded-lg border bg-background p-3">
                        <div className="text-xs text-muted-foreground">Outside</div>
                        <div className="text-xl font-semibold">{stats.outside}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Session & Count</div>
                      <div className="flex flex-wrap gap-2">
                        {sessionCountButton('All', stats.total, sessionFilter === allSessionValue, () => setSessionFilter(allSessionValue))}
                        {sessionCountEntries.entries.map(([name, count]) => (
                          <span key={name}>
                            {sessionCountButton(name, count + sessionCountEntries.committeeCount, sessionFilter === name, () => setSessionFilter(name))}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-8">
                  <div className="rounded-xl border bg-card shadow-sm p-4 space-y-4">
                    <div className="flex flex-col xl:flex-row xl:items-center gap-3">
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
                        <span className="text-sm font-semibold">{stats.total}</span>
                        <Button variant="outline" size="sm" onClick={exportCsv} className="ml-2">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Session</div>
                        <Select value={sessionFilter} onValueChange={(v) => setSessionFilter(v as SessionFilter)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {sessionOptions.map((name) => (
                              <SelectItem key={name} value={name}>{name === allSessionValue ? 'All' : name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Status</div>
                        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All</SelectItem>
                            <SelectItem value="BOOKED">Booked</SelectItem>
                            <SelectItem value="IN_GYM">Inside</SelectItem>
                            <SelectItem value="LEFT">Outside</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Access</div>
                        <Select value={accessFilter} onValueChange={(v) => setAccessFilter(v as AccessFilter)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All</SelectItem>
                            <SelectItem value="GRANTED">Granted</SelectItem>
                            <SelectItem value="NO_ACCESS">No Access</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button variant="outline" size="sm" onClick={resetFilters}>
                          Reset Filters
                        </Button>
                      </div>
                    </div>
                    {(search || sessionFilter !== allSessionValue || statusFilter !== 'ALL' || accessFilter !== 'ALL') && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Active Filters</span>
                        {search ? (
                          <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                            Search: {search}
                          </Button>
                        ) : null}
                        {sessionFilter !== allSessionValue ? (
                          <Button variant="secondary" size="sm" onClick={() => setSessionFilter(allSessionValue)}>
                            Session: {sessionFilter}
                          </Button>
                        ) : null}
                        {statusFilter !== 'ALL' ? (
                          <Button variant="secondary" size="sm" onClick={() => setStatusFilter('ALL')}>
                            Status: {statusFilter === 'IN_GYM' ? 'Inside' : statusFilter === 'LEFT' ? 'Outside' : 'Booked'}
                          </Button>
                        ) : null}
                        {accessFilter !== 'ALL' ? (
                          <Button variant="secondary" size="sm" onClick={() => setAccessFilter('ALL')}>
                            Access: {accessFilter === 'GRANTED' ? 'Granted' : 'No Access'}
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={resetFilters}>
                          Clear All
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {isLoadingStatus ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="md:hidden space-y-3">
                      {sorted.length < 1 ? (
                        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
                          No results.
                        </div>
                      ) : (
                        sorted.map((p, idx) => {
                          const key = `${p.employee_id}-${p.time_in}-${idx}`;
                          const sessionLabel = extractSessionName(p.schedule);
                          return (
                            <div
                              key={key}
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

                    <div className="hidden md:block rounded-xl border bg-card shadow-sm overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 text-right">No</TableHead>
                            <TableHead className={sortableHeadClass('name')} onClick={() => toggleSort('name')}>
                              Name {headerSortLabel('name')}
                            </TableHead>
                            <TableHead className={sortableHeadClass('employee_id')} onClick={() => toggleSort('employee_id')}>
                              ID Employee {headerSortLabel('employee_id')}
                            </TableHead>
                            <TableHead className={sortableHeadClass('department')} onClick={() => toggleSort('department')}>
                              Department {headerSortLabel('department')}
                            </TableHead>
                            <TableHead>Session</TableHead>
                            <TableHead className={sortableHeadClass('schedule')} onClick={() => toggleSort('schedule')}>
                              Time Schedule {headerSortLabel('schedule')}
                            </TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className={sortableHeadClass('time_in')} onClick={() => toggleSort('time_in')}>
                              Time In {headerSortLabel('time_in')}
                            </TableHead>
                            <TableHead className={sortableHeadClass('time_out')} onClick={() => toggleSort('time_out')}>
                              Time Out {headerSortLabel('time_out')}
                            </TableHead>
                            <TableHead className={sortableHeadClass('status')} onClick={() => toggleSort('status')}>
                              Status {headerSortLabel('status')}
                            </TableHead>
                            <TableHead>Access</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                        {sorted.map((p, idx) => (
                          <TableRow
                            key={`${p.employee_id}-${p.time_in}-${idx}`}
                            className={p.status === 'IN_GYM' ? 'bg-green-50' : p.status === 'BOOKED' ? 'bg-yellow-50' : ''}
                            onClick={() => p.employee_id && navigate(`/live_gym/${encodeURIComponent(String(p.employee_id))}`)}
                          >
                              <TableCell className="w-12 text-right">{idx + 1}</TableCell>
                              <TableCell className="font-medium">{getDisplayName(p)}</TableCell>
                              <TableCell>{p.employee_id ?? '-'}</TableCell>
                              <TableCell>{getDisplayDepartment(p)}</TableCell>
                              <TableCell>{getSessionChip(p.schedule)}</TableCell>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
