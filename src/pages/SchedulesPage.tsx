import { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, List, Pencil, Plus, Trash2, Search, ArrowUpDown, ChevronUp, ChevronDown, Copy, Download, Users as UsersIcon } from 'lucide-react';
import { useGymDbSessions, useGymDbSessionsPaged, GymDbSession } from '@/hooks/useGymDbSessions';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { GymSession, formatTime } from '@/hooks/useGymSessions';
import { WeeklyCalendar } from '@/components/schedules/WeeklyCalendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SessionDialog } from '@/components/schedules/SessionDialog';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GYM_SESSIONS } from '@/lib/gymSessions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export default function SchedulesPage() {
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [presetSession, setPresetSession] = useState<GymSession | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<GymDbSession | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState<GymDbSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [sortBy, setSortBy] = useState<null | 'session_name' | 'time_start' | 'time_end' | 'quota'>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: allSessionsForCalendar = [], isLoading: isLoadingAll } = useGymDbSessions();
  const { data: paged = { rows: [], total: 0 }, isLoading, refetch } = useGymDbSessionsPaged(search, page, pageSize, sortBy || undefined, sortDir);
  const sessions = paged.rows;
  const totalCount = paged.total;
  const endpoint = '/api';

  const [rosterDate, setRosterDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedAssign, setSelectedAssign] = useState<Map<number, string>>(new Map());
  const [rosterDatePopoverOpen, setRosterDatePopoverOpen] = useState(false);
  const rosterDateObj = useMemo(() => {
    const d = new Date(rosterDate);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [rosterDate]);

  const committeeQuery = useQuery({
    queryKey: ['gym-access-committee'],
    queryFn: async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch committee list');
        return (await resp.json()) as { ok: boolean; members?: Array<{ employee_id: string; unit_no: string; created_at: string | null; updated_at: string | null }>; error?: string };
      };
      try {
        const json = await tryFetch('/api/gym-access-committee');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch committee list');
        return Array.isArray(json.members) ? json.members : [];
      } catch (_) {
        const json = await tryFetch('/gym-access-committee');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch committee list');
        return Array.isArray(json.members) ? json.members : [];
      }
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const committeeIds = useMemo(() => (Array.isArray(committeeQuery.data) ? committeeQuery.data.map((m) => m.employee_id).filter(Boolean) : []), [committeeQuery.data]);

  const committeeDetailsQuery = useQuery({
    queryKey: ['employee-core', { ids: committeeIds.join(',') }],
    enabled: committeeIds.length > 0,
    queryFn: async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch employee details');
        return (await resp.json()) as { ok: boolean; employees?: Array<{ employee_id: string; name: string; department: string | null }>; error?: string };
      };
      const ids = committeeIds.join(',');
      try {
        const json = await tryFetch(`/api/employee-core?ids=${encodeURIComponent(ids)}&limit=200`);
        if (!json.ok) throw new Error(json.error || 'Failed to fetch employee details');
        return Array.isArray(json.employees) ? json.employees : [];
      } catch (_) {
        const json = await tryFetch(`/employee-core?ids=${encodeURIComponent(ids)}&limit=200`);
        if (!json.ok) throw new Error(json.error || 'Failed to fetch employee details');
        return Array.isArray(json.employees) ? json.employees : [];
      }
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const committeeInfoMap = useMemo(() => {
    const map = new Map<string, { name: string; department: string | null }>();
    const rows = Array.isArray(committeeDetailsQuery.data) ? committeeDetailsQuery.data : [];
    for (const r of rows) {
      map.set(String(r.employee_id), { name: String(r.name || '').trim(), department: r.department ?? null });
    }
    return map;
  }, [committeeDetailsQuery.data]);

  const rosterQuery = useQuery({
    queryKey: ['gym-committee-roster', rosterDate],
    queryFn: async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        const json = await resp.json();
        if (resp.status >= 500) throw new Error(json?.error || 'Server error');
        return json as { ok: boolean; roster?: Array<{ employee_id: string; schedule_id: number; duty_date: string; unit_no: string }>; error?: string };
      };
      try {
        const json = await tryFetch(`/api/gym-committee-roster?date=${encodeURIComponent(rosterDate)}`);
        if (!json.ok) throw new Error(json.error || 'Failed to fetch roster');
        return Array.isArray(json.roster) ? json.roster : [];
      } catch (_) {
        const json = await tryFetch(`/gym-committee-roster?date=${encodeURIComponent(rosterDate)}`);
        if (!json.ok) throw new Error(json.error || 'Failed to fetch roster');
        return Array.isArray(json.roster) ? json.roster : [];
      }
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const rosterBySchedule = useMemo(() => {
    const m = new Map<number, Array<{ employee_id: string; schedule_id: number }>>();
    const rows = Array.isArray(rosterQuery.data) ? rosterQuery.data : [];
    for (const r of rows) {
      const key = Number(r.schedule_id || 0) || 0;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push({ employee_id: String(r.employee_id), schedule_id: key });
    }
    return m;
  }, [rosterQuery.data]);

  const sessionListForRoster: GymDbSession[] = useMemo(() => {
    const rows = Array.isArray(allSessionsForCalendar) ? allSessionsForCalendar : [];
    const sorted = [...rows].sort((a, b) => String(a.time_start).localeCompare(String(b.time_start)) || String(a.session_name).localeCompare(String(b.session_name)));
    return sorted;
  }, [allSessionsForCalendar]);

  const assignRosterMutation = useMutation({
    mutationFn: async (payload: { employee_id: string; schedule_id: number; duty_date: string }) => {
      if (!payload.schedule_id || payload.schedule_id <= 0) throw new Error('ScheduleID tidak tersedia untuk sesi ini');
      const post = async (url: string) => {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const j = await r.json();
        if (r.status >= 500) throw new Error(j?.error || 'Server error');
        if (!j?.ok) throw new Error(j?.error || 'Failed to assign');
        return true;
      };
      try {
        await post('/api/gym-committee-roster-assign');
      } catch (_) {
        await post('/gym-committee-roster-assign');
      }
      return true;
    },
    onSuccess: () => {
      toast.success('Penjaga ditambahkan');
      rosterQuery.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Gagal assign'),
  });

  const removeRosterMutation = useMutation({
    mutationFn: async (payload: { employee_id: string; schedule_id: number; duty_date: string }) => {
      const post = async (url: string) => {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const j = await r.json();
        if (r.status >= 500) throw new Error(j?.error || 'Server error');
        if (!j?.ok) throw new Error(j?.error || 'Failed to remove');
        return true;
      };
      try {
        await post('/api/gym-committee-roster-remove');
      } catch (_) {
        await post('/gym-committee-roster-remove');
      }
      return true;
    },
    onSuccess: () => {
      toast.success('Penjaga dihapus');
      rosterQuery.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Gagal hapus'),
  });

  const endFor = (label: string): string | null => {
    switch (label) {
      case 'Morning':
        return '06:30';
      case 'Night 1':
        return '20:00';
      case 'Night 2':
        return '22:00';
      default:
        return null;
    }
  };

  const timeEndForSession = (session: GymDbSession): string =>
    session.time_end ?? endFor(session.session_name) ?? session.time_start;

  const toDialogSession = (session: GymDbSession): GymSession => ({
    id: `gymdb-${session.session_name}-${session.time_start}`,
    schedule_id: session.schedule_id,
    session_name: session.session_name,
    time_start: session.time_start,
    time_end: timeEndForSession(session),
    quota: session.quota,
    created_at: '',
    updated_at: '',
  });

  const calendarSessions: GymSession[] = (allSessionsForCalendar || []).map((s: GymDbSession, idx) => {
    const timeEnd = s.time_end ?? endFor(s.session_name) ?? '00:00';
    return {
      id: `gymdb-${s.session_name}-${s.time_start}-${idx}`,
      schedule_id: s.schedule_id,
      session_name: s.session_name,
      time_start: s.time_start,
      time_end: timeEnd,
      quota: s.quota,
      created_at: '',
      updated_at: '',
    };
  });

  const openWithPreset = (name: string, start: string, end: string, quota: number = 15) => {
    setPresetSession({
      id: `preset-${name}-${start}`,
      session_name: name,
      time_start: start,
      time_end: end,
      quota,
      created_at: '',
      updated_at: '',
    });
    setSessionDialogOpen(true);
  };

  const exportCsv = () => {
    const header = ['Session', 'Time Start', 'Time End', 'Quota'];
    const rows = sessions.map((s) => [s.session_name, s.time_start, s.time_end || '', String(s.quota)]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gym-sessions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const SessionBadge = ({ name }: { name: string }) => {
    const key = name.toLowerCase();
    const color = key.includes('morning')
      ? 'bg-green-100 text-green-900'
      : key.includes('afternoon')
      ? 'bg-blue-100 text-blue-900'
      : key.includes('night') && (key.includes('1') || key.includes('- 1'))
      ? 'bg-purple-100 text-purple-900'
      : key.includes('night') && (key.includes('2') || key.includes('- 2'))
      ? 'bg-amber-100 text-amber-900'
      : 'bg-slate-100 text-slate-900';
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md font-medium ${color}`}>{name}</span>;
  };

  const toggleSort = (key: 'session_name' | 'time_start' | 'time_end' | 'quota') => {
    setPage(1);
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const SortIndicator = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => {
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />;
    return dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 md:-mb-6">
          <Card className="flex w-full flex-col rounded-none md:min-h-[calc(100svh-3.5rem)] md:rounded-xl md:rounded-t-none md:border-t-0">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="text-2xl font-semibold flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CalendarIcon className="h-5 w-5" />
                </span>
                Schedules
              </CardTitle>
              <CardDescription>Manage gym sessions and view calendar.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <Tabs defaultValue="sessions" className="w-full">
                <TabsList className="bg-muted/40 p-1 rounded-lg">
                  <TabsTrigger value="sessions" className="flex items-center gap-2">
                    <List className="h-4 w-4" />
                    Sessions
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Calendar
                  </TabsTrigger>
                  <TabsTrigger value="roster" className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4" />
                    Roster
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sessions" className="space-y-4 mt-4">
                  <div className="rounded-xl border bg-card shadow-sm p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={search}
                          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                          placeholder="Search session name or time (HH:MM)"
                          className="pl-9"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button onClick={() => { setPresetSession(null); setSessionDialogOpen(true); }}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Session
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                              Preset
                              <ChevronDown className="h-4 w-4 ml-2" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {GYM_SESSIONS.map((s) => (
                              <DropdownMenuItem key={s.id} onClick={() => openWithPreset(s.name, s.startTime, s.endTime)}>
                                {s.name} ({s.startTime}-{s.endTime})
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" onClick={exportCsv}>
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['ALL','Morning','Afternoon','Night 1','Night 2'].map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setSearch(label === 'ALL' ? '' : label)}
                          className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${
                            (search || '') === (label === 'ALL' ? '' : label) ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground'
                          }`}
                          aria-pressed={(search || '') === (label === 'ALL' ? '' : label)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {isLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : sessions && sessions.length > 0 ? (
                    <div className="space-y-2">
                      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">No</TableHead>
                              <TableHead>
                                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('session_name')}>
                                  Session
                                  <SortIndicator active={sortBy === 'session_name'} dir={sortDir} />
                                </button>
                              </TableHead>
                              <TableHead>
                                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('time_start')}>
                                  Time Start
                                  <SortIndicator active={sortBy === 'time_start'} dir={sortDir} />
                                </button>
                              </TableHead>
                              <TableHead>
                                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('time_end')}>
                                  Time End
                                  <SortIndicator active={sortBy === 'time_end'} dir={sortDir} />
                                </button>
                              </TableHead>
                              <TableHead>
                                <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('quota')}>
                                  Quota
                                  <SortIndicator active={sortBy === 'quota'} dir={sortDir} />
                                </button>
                              </TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sessions.map((session, index) => (
                              <TableRow key={`${session.session_name}-${session.time_start}-${index}`}>
                                <TableCell className="font-medium">{(page - 1) * pageSize + index + 1}</TableCell>
                                <TableCell className="font-medium"><SessionBadge name={session.session_name} /></TableCell>
                                <TableCell>{formatTime(session.time_start)}</TableCell>
                                <TableCell>{session.time_end ? formatTime(session.time_end) : '-'}</TableCell>
                                <TableCell>{session.quota}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setEditingSession(session);
                                        setEditDialogOpen(true);
                                      }}
                                      title="Edit"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setPresetSession(toDialogSession(session));
                                        setSessionDialogOpen(true);
                                      }}
                                      title="Duplicate"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => {
                                        setDeletingSession(session);
                                        setDeleteDialogOpen(true);
                                      }}
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Rows per page</span>
                          <Tabs value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                            <TabsList>
                              <TabsTrigger value="6">6</TabsTrigger>
                              <TabsTrigger value="10">10</TabsTrigger>
                              <TabsTrigger value="20">20</TabsTrigger>
                              <TabsTrigger value="50">50</TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))}</span>
                          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</Button>
                          <Button variant="outline" size="sm" onClick={() => setPage((p) => (p < Math.ceil(totalCount / pageSize) ? p + 1 : p))} disabled={page >= Math.ceil(totalCount / pageSize)}>Next</Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-16">
                      <div className="flex flex-col items-center justify-center p-8 bg-card rounded-xl shadow-sm border max-w-md text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 mb-4">
                          <CalendarIcon className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Belum ada jadwal gym</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                          Buat jadwal gym untuk mulai mengatur sesi dan kuota.
                        </p>
                        <Button onClick={() => setSessionDialogOpen(true)} className="gap-2">
                          <Plus className="h-4 w-4" />
                          Buat Jadwal Gym
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="calendar" className="mt-4">
                  <WeeklyCalendar 
                    sessions={calendarSessions} 
                    onCreateSession={() => setSessionDialogOpen(true)}
                    onSelectSession={(session) => { setPresetSession(session); setSessionDialogOpen(true); }}
                  />
                </TabsContent>

                <TabsContent value="roster" className="mt-4 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div className="w-full md:w-64">
                      <div className="text-sm text-muted-foreground mb-1">Tanggal</div>
                      <Popover open={rosterDatePopoverOpen} onOpenChange={setRosterDatePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal touch-target',
                              !rosterDate && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
                            {rosterDateObj ? format(rosterDateObj, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={rosterDateObj}
                            onSelect={(d) => {
                              if (d) {
                                setRosterDate(format(d, 'yyyy-MM-dd'));
                                setRosterDatePopoverOpen(false);
                              }
                            }}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="w-full md:flex-1"></div>
                  </div>
                  <div className="rounded-lg border bg-card overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">No</TableHead>
                          <TableHead>Session</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Penjaga</TableHead>
                          <TableHead className="text-right">Assign</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessionListForRoster.map((s, idx) => {
                          const assigned = rosterBySchedule.get(s.schedule_id || 0) || [];
                          const isFull = assigned.length >= 2;
                          return (
                            <TableRow key={`roster-${String(s.session_name)}-${String(s.time_start)}-${idx}`}>
                              <TableCell className="font-medium">{idx + 1}</TableCell>
                              <TableCell className="font-medium"><SessionBadge name={s.session_name} /></TableCell>
                              <TableCell>{formatTime(s.time_start)}{s.time_end ? ` - ${formatTime(s.time_end)}` : ''}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  {assigned.map((r) => {
                                    const info = committeeInfoMap.get(r.employee_id) || { name: '-', department: null };
                                    return (
                                      <div key={`${r.employee_id}-${r.schedule_id}`} className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                                        <span className="font-mono">{r.employee_id}</span>
                                        <span className="font-medium">{info.name || '-'}</span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-destructive"
                                          onClick={() => removeRosterMutation.mutate({ employee_id: r.employee_id, schedule_id: r.schedule_id, duty_date: rosterDate })}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    );
                                  })}
                                  {assigned.length === 0 && <span className="text-xs text-muted-foreground">Belum ada penjaga.</span>}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <Select value={selectedAssign.get(s.schedule_id || 0) || ''} onValueChange={(v) => setSelectedAssign((m) => new Map(m).set(s.schedule_id || 0, v))} disabled={!s.schedule_id || s.schedule_id <= 0 || isFull}>
                                    <SelectTrigger className="w-56">
                                      <SelectValue placeholder={isFull ? 'Kapasitas sesi penuh (max 2)' : 'Pilih anggota komite'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {committeeIds.map((id) => {
                                        const info = committeeInfoMap.get(id) || { name: '-', department: null };
                                        return (
                                          <SelectItem key={id} value={id}>{id} — {info.name || '-'}</SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    onClick={() => {
                                      const emp = selectedAssign.get(s.schedule_id || 0) || '';
                                      if (!emp) { toast.error('Pilih anggota komite terlebih dahulu'); return; }
                                      assignRosterMutation.mutate({ employee_id: emp, schedule_id: s.schedule_id || 0, duty_date: rosterDate });
                                    }}
                                    disabled={!s.schedule_id || s.schedule_id <= 0 || isFull}
                                  >
                                    Assign
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>


      <SessionDialog
        open={sessionDialogOpen}
        onOpenChange={(open) => { setSessionDialogOpen(open); if (!open) setPresetSession(null); }}
        onSubmit={async (data) => {
          try {
            const tryPost = async (url: string) => {
              const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  session_name: data.session_name,
                  time_start: data.time_start,
                  time_end: data.time_end,
                  quota: data.quota,
                }),
              });
              const j = await r.json();
              if (r.status >= 500) throw new Error(j?.error || 'Server error');
              return j;
            };
            let json: { ok: boolean; error?: string } = { ok: false };
            try {
              json = await tryPost(`${endpoint}/gym-session-create`);
            } catch (_) {
              json = await tryPost(`/gym-session-create`);
            }
            if (!json?.ok) throw new Error(json?.error || 'Failed to create session');
            toast.success('Session created');
            setSessionDialogOpen(false);
            refetch();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to create session');
          }
        }}
        isLoading={false}
        session={presetSession}
        mode="create"
      />

      <SessionDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingSession(null);
        }}
        session={editingSession ? toDialogSession(editingSession) : null}
        onSubmit={async (data) => {
          if (!editingSession) return;
          setIsSaving(true);
          try {
            const tryPost2 = async (url: string) => {
              const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  original_session_name: editingSession.session_name,
                  original_time_start: editingSession.time_start,
                  session_name: data.session_name,
                  time_start: data.time_start,
                  time_end: data.time_end,
                  quota: data.quota,
                }),
              });
              const j = await r.json();
              if (r.status >= 500) throw new Error(j?.error || 'Server error');
              return j;
            };
            let json2: { ok: boolean; error?: string } = { ok: false };
            try {
              json2 = await tryPost2(`${endpoint}/gym-session-update`);
            } catch (_) {
              json2 = await tryPost2(`/gym-session-update`);
            }
            if (!json2?.ok) throw new Error(json2?.error || 'Failed to update session');
            toast.success('Session updated');
            setEditDialogOpen(false);
            setEditingSession(null);
            refetch();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update session');
          } finally {
            setIsSaving(false);
          }
        }}
        isLoading={isSaving}
      />

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeletingSession(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deletingSession) return;
                setIsDeleting(true);
                try {
                  const tryPost3 = async (url: string) => {
                    const r = await fetch(url, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        session_name: deletingSession.session_name,
                        time_start: deletingSession.time_start,
                      }),
                    });
                    const j = await r.json();
                    if (r.status >= 500) throw new Error(j?.error || 'Server error');
                    return j;
                  };
                  let json3: { ok: boolean; error?: string } = { ok: false };
                  try {
                    json3 = await tryPost3(`${endpoint}/gym-session-delete`);
                  } catch (_) {
                    json3 = await tryPost3(`/gym-session-delete`);
                  }
                  if (!json3?.ok) throw new Error(json3?.error || 'Failed to delete session');
                  toast.success('Session deleted');
                  setDeleteDialogOpen(false);
                  setDeletingSession(null);
                  refetch();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Failed to delete session');
                } finally {
                  setIsDeleting(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
