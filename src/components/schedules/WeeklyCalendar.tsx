import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, Users } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, getWeek, isSameDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { GymSession, formatTime } from '@/hooks/useGymSessions';
import { useQuery } from '@tanstack/react-query';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface WeeklyCalendarProps {
  sessions: GymSession[];
  onCreateSession?: () => void;
  onSelectSession?: (session: GymSession) => void;
}

const START_HOUR = 5;
const END_HOUR = 23;
const TIME_SLOTS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
  const hour = i + START_HOUR;
  return `${hour.toString().padStart(2, '0')}:00`;
});

const SESSION_COLORS = [
  'bg-emerald-100 border-l-4 border-emerald-500 text-emerald-800',
  'bg-blue-100 border-l-4 border-blue-500 text-blue-800',
  'bg-purple-100 border-l-4 border-purple-500 text-purple-800',
  'bg-amber-100 border-l-4 border-amber-500 text-amber-800',
  'bg-rose-100 border-l-4 border-rose-500 text-rose-800',
  'bg-cyan-100 border-l-4 border-cyan-500 text-cyan-800',
];

export function WeeklyCalendar({ sessions, onCreateSession, onSelectSession }: WeeklyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [visibleIds, setVisibleIds] = useState<string[]>(sessions.map((s) => s.id));

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekNumber = getWeek(currentDate, { weekStartsOn: 1 });

  const weekStartKey = format(weekStart, 'yyyy-MM-dd');

  const { data: weekAvailability } = useQuery({
    queryKey: ['gym-availability-week', weekStartKey],
    queryFn: async (): Promise<
      Record<
        string,
        {
          totalAvailable: number;
          totalQuota: number;
          byTimeStart: Record<string, { available: number; booked: number; quota: number }>;
        }
      >
    > => {
      const fetchOneDay = async (dateKey: string) => {
        const params = `date=${encodeURIComponent(dateKey)}`;
        const doFetch = async (url: string) => {
          const resp = await fetch(`${url}?${params}`);
          const json = (await resp.json()) as
            | {
                success: boolean;
                sessions?: Array<{ time_start: string; available: number; booked_count: number; quota: number }>;
                error?: string;
              }
            | null;
          if (resp.status >= 500) throw new Error(json?.error || 'Server error');
          return json;
        };

        let json:
          | {
              success: boolean;
              sessions?: Array<{ time_start: string; available: number; booked_count: number; quota: number }>;
            }
          | null = null;

        try {
          json = await doFetch('/api/gym-availability');
        } catch (_) {
          json = await doFetch('/gym-availability');
        }

        const rows = json && json.success && Array.isArray(json.sessions) ? json.sessions : [];
        const byTimeStart: Record<string, { available: number; booked: number; quota: number }> = {};
        let totalAvailable = 0;
        let totalQuota = 0;
        rows.forEach((r) => {
          const timeStart = String(r.time_start || '').trim();
          if (!timeStart) return;
          const available = Number(r.available || 0);
          const booked = Number(r.booked_count || 0);
          const quota = Number(r.quota || 0);
          byTimeStart[timeStart] = { available, booked, quota };
          totalAvailable += available;
          totalQuota += quota;
        });

        return { totalAvailable, totalQuota, byTimeStart };
      };

      const keys = weekDays.map((d) => format(d, 'yyyy-MM-dd'));
      const results = await Promise.all(keys.map((k) => fetchOneDay(k)));
      const map: Record<
        string,
        {
          totalAvailable: number;
          totalQuota: number;
          byTimeStart: Record<string, { available: number; booked: number; quota: number }>;
        }
      > = {};
      keys.forEach((k, idx) => {
        map[k] = results[idx];
      });
      return map;
    },
    staleTime: 30_000,
  });

  const { data: weekRoster } = useQuery({
    queryKey: ['gym-committee-roster-week', weekStartKey],
    queryFn: async (): Promise<Record<string, Record<number, number>>> => {
      const fetchOneDay = async (dateKey: string) => {
        const params = `date=${encodeURIComponent(dateKey)}`;
        const doFetch = async (url: string) => {
          const resp = await fetch(`${url}?${params}`);
          const json = await resp.json();
          if (resp.status >= 500) throw new Error(json?.error || 'Server error');
          return json as { ok: boolean; roster?: Array<{ schedule_id: number; employee_id: string }>; error?: string };
        };
        let json: { ok: boolean; roster?: Array<{ schedule_id: number; employee_id: string }>; error?: string } | null = null;
        try {
          json = await doFetch('/api/gym-committee-roster');
        } catch (_) {
          json = await doFetch('/gym-committee-roster');
        }
        const rows = json && json.ok && Array.isArray(json.roster) ? json.roster : [];
        const byScheduleId: Record<number, number> = {};
        for (const r of rows) {
          const sid = Number(r.schedule_id || 0) || 0;
          if (!sid) continue;
          byScheduleId[sid] = (byScheduleId[sid] || 0) + 1;
        }
        return byScheduleId;
      };
      const keys = weekDays.map((d) => format(d, 'yyyy-MM-dd'));
      const results = await Promise.all(keys.map((k) => fetchOneDay(k)));
      const map: Record<string, Record<number, number>> = {};
      keys.forEach((k, idx) => { map[k] = results[idx]; });
      return map;
    },
    staleTime: 10_000,
  });

  const { data: weekRosterDetail } = useQuery({
    queryKey: ['gym-committee-roster-week-detail', weekStartKey],
    queryFn: async (): Promise<Record<string, Record<number, Array<{ employee_id: string }>>>> => {
      const fetchOneDay = async (dateKey: string) => {
        const params = `date=${encodeURIComponent(dateKey)}`;
        const doFetch = async (url: string) => {
          const resp = await fetch(`${url}?${params}`);
          const json = await resp.json();
          if (resp.status >= 500) throw new Error(json?.error || 'Server error');
          return json as { ok: boolean; roster?: Array<{ schedule_id: number; employee_id: string }>; error?: string };
        };
        let json: { ok: boolean; roster?: Array<{ schedule_id: number; employee_id: string }>; error?: string } | null = null;
        try {
          json = await doFetch('/api/gym-committee-roster');
        } catch (_) {
          json = await doFetch('/gym-committee-roster');
        }
        const rows = json && json.ok && Array.isArray(json.roster) ? json.roster : [];
        const byScheduleId: Record<number, Array<{ employee_id: string }>> = {};
        for (const r of rows) {
          const sid = Number(r.schedule_id || 0) || 0;
          if (!sid) continue;
          if (!byScheduleId[sid]) byScheduleId[sid] = [];
          byScheduleId[sid].push({ employee_id: String(r.employee_id) });
        }
        return byScheduleId;
      };
      const keys = weekDays.map((d) => format(d, 'yyyy-MM-dd'));
      const results = await Promise.all(keys.map((k) => fetchOneDay(k)));
      const map: Record<string, Record<number, Array<{ employee_id: string }>>> = {};
      keys.forEach((k, idx) => { map[k] = results[idx]; });
      return map;
    },
    staleTime: 10_000,
  });

  const { data: weekReportsMap } = useQuery({
    queryKey: ['gym-reports-week', weekStartKey],
    queryFn: async () => {
      const fromStr = format(weekStart, 'yyyy-MM-dd');
      const toStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
      const tryFetch = async (base: string) => {
        const resp = await fetch(`${base}/gym-reports?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&limit=5000`);
        const json = await resp.json();
        const rows = Array.isArray(json?.reports) ? json.reports : [];
        const map = new Map<string, { name: string; department: string | null }>();
        const normalize = (id: string) => String(id || '').replace(/[^0-9]/g, '');
        for (const r of rows) {
          const obj = r as { EmployeeID?: string; employee_id?: string; Name?: string | null; name?: string | null; Department?: string | null; department?: string | null };
          const raw = String(obj.EmployeeID ?? obj.employee_id ?? '').trim();
          if (!raw) continue;
          const info = { name: String(obj.Name ?? obj.name ?? '').trim(), department: (obj.Department ?? obj.department ?? null) != null ? String(obj.Department ?? obj.department).trim() : null };
          map.set(raw, info);
          const norm = normalize(raw);
          if (norm && norm !== raw) map.set(norm, info);
        }
        return map;
      };
      try {
        return await tryFetch('/api');
      } catch (_) {
        return await tryFetch('');
      }
    },
    staleTime: 60_000,
  });

  const rosterEmployeeIds = useMemo(() => {
    const set = new Set<string>();
    const normalize = (id: string) => String(id || '').replace(/[^0-9]/g, '');
    const dayKeys = weekDays.map((d) => format(d, 'yyyy-MM-dd'));
    for (const dayKey of dayKeys) {
      const bySched = weekRosterDetail?.[dayKey] || {};
      for (const sid of Object.keys(bySched)) {
        const list = bySched[Number(sid)] || [];
        for (const r of list) {
          const raw = String(r.employee_id);
          set.add(raw);
          const norm = normalize(raw);
          if (norm && norm !== raw) set.add(norm);
        }
      }
    }
    return Array.from(set);
  }, [weekDays, weekRosterDetail]);

  const { data: employeeDetails } = useQuery({
    queryKey: ['employee-core', { ids: rosterEmployeeIds.join(',') }],
    enabled: rosterEmployeeIds.length > 0,
    queryFn: async () => {
      const ids = rosterEmployeeIds.join(',');
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch employee details');
        return (await resp.json()) as { ok: boolean; employees?: Array<{ employee_id: string; name: string; department: string | null }>; error?: string };
      };
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
  });

  const employeeInfoMap = useMemo(() => {
    const map = new Map<string, { name: string; department: string | null }>();
    const normalize = (id: string) => String(id || '').replace(/[^0-9]/g, '');
    if (weekReportsMap && weekReportsMap.size > 0) {
      weekReportsMap.forEach((info, key) => {
        map.set(key, { name: info.name, department: info.department });
      });
    }
    const rows = Array.isArray(employeeDetails) ? employeeDetails : [];
    for (const r of rows) {
      const raw = String(r.employee_id);
      const info = { name: String(r.name || '').trim(), department: r.department ?? null };
      map.set(raw, info);
      const norm = normalize(raw);
      if (norm && norm !== raw) map.set(norm, info);
    }
    return map;
  }, [employeeDetails, weekReportsMap]);

  const getInitials = (name: string): string => {
    const n = String(name || '').trim();
    if (!n) return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getDeptColorClass = (department: string | null | undefined): string => {
    const d = String(department || '').trim().toLowerCase();
    if (!d) return 'bg-slate-200 text-slate-900';
    if (d.includes('safety')) return 'bg-green-200 text-slate-900';
    if (d.includes('operation')) return 'bg-blue-200 text-slate-900';
    if (d.includes('security')) return 'bg-purple-200 text-slate-900';
    if (d.includes('human') || d === 'hr' || d.includes('personnel')) return 'bg-rose-200 text-slate-900';
    if (d.includes('it') || d.includes('information')) return 'bg-cyan-200 text-slate-900';
    if (d.includes('finance') || d.includes('account')) return 'bg-amber-200 text-slate-900';
    if (d.includes('procure')) return 'bg-lime-200 text-slate-900';
    if (d.includes('maint') || d.includes('engineer')) return 'bg-orange-200 text-slate-900';
    if (d.includes('admin')) return 'bg-slate-200 text-slate-900';
    return 'bg-slate-200 text-slate-900';
  };

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setCurrentDate(date);
    }
  };

  const getSessionPosition = (session: GymSession) => {
    const [startHour, startMin] = session.time_start.split(':').map(Number);
    const [endHour, endMin] = session.time_end.split(':').map(Number);
    
    const startOffset = (startHour - START_HOUR) * 64 + (startMin / 60) * 64; // 64px per hour
    const duration = ((endHour - startHour) * 60 + (endMin - startMin)) / 60 * 64;
    
    return { top: startOffset, height: Math.max(duration, 32) };
  };

  // Assign colors to sessions
  const sessionColorMap = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((session, index) => {
      map.set(session.id, SESSION_COLORS[index % SESSION_COLORS.length]);
    });
    return map;
  }, [sessions]);

  const visibleSessions = useMemo(() => {
    const set = new Set(visibleIds);
    return sessions.filter((s) => set.has(s.id));
  }, [sessions, visibleIds]);

  const departmentLegend = useMemo(() => {
    const labels = [
      'Safety',
      'Operations',
      'Security',
      'HR',
      'IT',
      'Finance/Accounting',
      'Procurement',
      'Maintenance/Engineering',
      'Admin',
      'Other',
    ];
    return labels.map((label) => {
      const bg = getDeptColorClass(label).split(' ')[0];
      return { label, bg };
    });
  }, []);

  return (
    <div className="flex gap-6">
      {/* Left sidebar with mini calendar */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <Card>
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="w-full pointer-events-auto"
            />
          </CardContent>
        </Card>

        {/* Departments Legend */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Departments</h3>
            <div className="space-y-2">
              {departmentLegend.map((dep) => (
                <div key={dep.label} className="flex items-center gap-2 text-sm">
                  <div className={cn("w-4 h-4 rounded", dep.bg)} />
                  <span className="flex-1">{dep.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sessions Legend */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Sessions</h3>
            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center gap-2 text-sm">
                  <div className={cn(
                    "w-4 h-4 rounded",
                    sessionColorMap.get(session.id)?.split(' ')[0]
                  )} />
                  <span className="flex-1 truncate">{session.session_name}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatTime(session.time_start)}
                  </span>
                  <Checkbox
                    checked={visibleIds.includes(session.id)}
                    onCheckedChange={(checked) => {
                      setVisibleIds((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(session.id);
                        else next.delete(session.id);
                        return Array.from(next);
                      });
                    }}
                    aria-label={`Toggle ${session.session_name}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly view */}
      <div className="flex-1 min-w-0">
        {/* Header with navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handlePrevWeek}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNextWeek}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <h2 className="text-xl font-semibold">
              {format(weekStart, 'MMMM d')} - {format(addDays(weekStart, 6), 'd, yyyy')}
            </h2>
            <Badge variant="secondary" className="font-normal">
              Week {weekNumber}
            </Badge>
          </div>
          
          
        </div>

        {/* Week grid */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
              <div className="p-3" /> {/* Empty corner */}
              {weekDays.map((day, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 text-center border-l",
                    isSameDay(day, new Date()) && "bg-primary/5"
                  )}
                >
                  <div className="text-xs font-medium text-muted-foreground uppercase">
                    {format(day, 'EEE')}
                  </div>
                  <div className={cn(
                    "text-2xl font-semibold mt-1",
                    isSameDay(day, new Date()) && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </div>
                  {(() => {
                    const key = format(day, 'yyyy-MM-dd');
                    const info = weekAvailability?.[key];
                    if (!info) return null;
                    const tone =
                      info.totalAvailable <= 0
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200';
                    return (
                      <div className="mt-1 flex justify-center">
                        <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium', tone)}>
                          {info.totalAvailable} available
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
              {/* Time labels */}
              <div className="border-r">
                {TIME_SLOTS.map((time) => (
                  <div key={time} className="h-16 px-2 py-1 text-xs text-muted-foreground text-right border-b">
                    {time}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={cn(
                    "relative border-l",
                    isSameDay(day, new Date()) && "bg-primary/5"
                  )}
                >
                  {/* Hour grid lines */}
                  {TIME_SLOTS.map((_, index) => (
                    <div key={index} className="h-16 border-b" />
                  ))}

                  {/* Sessions */}
                  {visibleSessions.map((session) => {
                    const { top, height } = getSessionPosition(session);
                    const colorClass = sessionColorMap.get(session.id) || SESSION_COLORS[0];
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const availabilityForSession = weekAvailability?.[dayKey]?.byTimeStart?.[session.time_start] || null;
                    const rosterList = session.schedule_id ? weekRosterDetail?.[dayKey]?.[session.schedule_id] || [] : [];
                    const rosterCount = rosterList.length;
                    
                    // Only show if within visible time range
                    const [startHour] = session.time_start.split(':').map(Number);
                    if (startHour < START_HOUR || startHour >= END_HOUR) return null;

                    return (
                      <Popover key={`${session.id}-${dayIndex}`}>
                        <PopoverTrigger asChild>
                          <div
                            className={cn(
                              "absolute left-1 right-1 rounded px-2 py-1 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity",
                              colorClass
                            )}
                            style={{ top: `${top}px`, height: `${height}px` }}
                            onDoubleClick={() => onSelectSession?.(session)}
                          >
                            <div className="text-xs font-medium truncate">
                              {session.session_name}
                            </div>
                            {session.schedule_id ? (
                              <div className="absolute top-1 right-1">
                                <span className="inline-flex items-center rounded-md border bg-white/70 backdrop-blur px-1.5 py-0.5 text-[10px] font-medium">
                                  <Users className="h-3 w-3 mr-1" />
                                  {rosterCount}
                                </span>
                              </div>
                            ) : null}
                            {session.schedule_id && rosterList.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {rosterList.slice(0, 2).map((r) => {
                                  const normalize = (id: string) => String(id || '').replace(/[^0-9]/g, '');
                                  const idRaw = r.employee_id;
                                  const idNorm = normalize(idRaw);
                                  const info = employeeInfoMap.get(idRaw) || employeeInfoMap.get(idNorm) || { name: '', department: null };
                                  const label = info.name || '-';
                                  const initials = getInitials(info.name);
                                  const deptClass = getDeptColorClass(info.department);
                                  return (
                                    <span key={`${dayKey}-${session.schedule_id}-${r.employee_id}-chip`} className="inline-flex items-center rounded-md border bg-white/70 backdrop-blur px-1.5 py-0.5 text-[10px] font-medium">
                                      <Avatar className="h-4 w-4 mr-1">
                                        <AvatarFallback className={`text-[9px] ${deptClass}`}>{initials}</AvatarFallback>
                                      </Avatar>
                                      <span className="whitespace-normal break-words">{label}</span>
                                    </span>
                                  );
                                })}
                                {rosterList.length > 2 ? (
                                  <span className="inline-flex items-center rounded-md border bg-white/70 backdrop-blur px-1.5 py-0.5 text-[10px] font-medium">+{rosterList.length - 2}</span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" side="right">
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-semibold">{session.session_name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {format(day, 'EEEE, MMMM d')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {formatTime(session.time_start)} - {formatTime(session.time_end)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {availabilityForSession
                                  ? `Available: ${availabilityForSession.available} / ${availabilityForSession.quota}`
                                  : `Quota: ${session.quota}`}
                              </span>
                            </div>
                            {session.schedule_id ? (
                              <div className="space-y-1">
                                <div className="text-xs font-medium">Penjaga</div>
                                {rosterList.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {rosterList.map((r) => {
                                      const normalize = (id: string) => String(id || '').replace(/[^0-9]/g, '');
                                      const idRaw = r.employee_id;
                                      const idNorm = normalize(idRaw);
                                      const info = employeeInfoMap.get(idRaw) || employeeInfoMap.get(idNorm) || { name: '-', department: null };
                                      return (
                                        <span key={`${dayKey}-${session.schedule_id}-${r.employee_id}`} className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium bg-muted/30">
                                          <span className="font-mono mr-1">{r.employee_id}</span>
                                          <span className="whitespace-normal break-words">{info.name || '-'}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Belum ada penjaga.</span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
