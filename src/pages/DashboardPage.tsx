import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, BarChart3, LayoutDashboard, CheckCircle, RefreshCw, Dumbbell, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/StatCard';
import { OccupancyCard } from '@/components/OccupancyCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty, CommandSeparator, CommandShortcut } from '@/components/ui/command';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { useGymOccupancy, useTodayBookingStats, useTodayBookingsSimple } from '@/hooks/useGymSchedules';
import { useWeeklyTrendsData, useTodayBreakdown, DailyData, SessionToday } from '@/hooks/useGymAnalytics';

const titleCase = (raw: string): string =>
  String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (/[A-Za-z]/.test(w) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');

const sessionTimeLabel = (s: SessionToday): string =>
  s.time_end && s.time_end !== s.time_start ? `${s.time_start} - ${s.time_end}` : s.time_start;

interface DonutItem {
  label: string;
  value: number;
  hex: string;
  dot: string;
}

// Reusable doughnut: ring chart + center total + legend (label · count · %).
function DonutBreakdown({ items }: { items: DonutItem[] }) {
  const total = items.reduce((acc, i) => acc + Number(i.value || 0), 0);
  if (total === 0) {
    return <div className="text-sm text-muted-foreground">Belum ada data hari ini.</div>;
  }
  const pieData = items.filter((i) => i.value > 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="label" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
              {pieData.map((d) => (
                <Cell key={d.label} fill={d.hex} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold leading-none">{total}</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total</div>
        </div>
      </div>
      <div className="w-full flex-1 space-y-2">
        {items.map((i) => (
          <div key={i.label} className="flex items-center gap-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${i.dot}`} />
            <span className="flex-1">{i.label}</span>
            <span className="font-medium tabular-nums">{i.value}</span>
            <span className="w-12 text-right tabular-nums text-muted-foreground">{Math.round((i.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(30000);

  const { data: occupancy, isLoading: occupancyLoading, isFetching: occupancyFetching, dataUpdatedAt: occupancyUpdatedAt, refetch: refetchOccupancy } = useGymOccupancy({
    refetchInterval: autoRefresh ? refreshInterval : undefined,
    staleTime: refreshInterval,
    enabled: true,
  });
  const { data: todayStats, isLoading: statsLoading, isFetching: statsFetching, dataUpdatedAt: statsUpdatedAt, refetch: refetchStats } = useTodayBookingStats({
    staleTime: refreshInterval,
    refetchInterval: autoRefresh ? refreshInterval : undefined,
    enabled: true,
  });

  const { data: weeklyTrendsData, isLoading: weeklyLoading } = useWeeklyTrendsData();
  const { data: todayBreakdown, isLoading: breakdownLoading } = useTodayBreakdown();
  const sessionsToday = useMemo(() => todayBreakdown?.sessions ?? [], [todayBreakdown]);
  const gender = todayBreakdown?.gender ?? { male: 0, female: 0, unknown: 0, total: 0 };

  const isLoading = occupancyLoading || statsLoading;

  const lastUpdated = useMemo(() => {
    const t = Math.max(Number(occupancyUpdatedAt || 0), Number(statsUpdatedAt || 0));
    return t ? new Date(t) : null;
  }, [occupancyUpdatedAt, statsUpdatedAt]);

  const isRefreshing = occupancyFetching || statsFetching;

  const [commandOpen, setCommandOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'booked' | null>(null);
  const { data: bookedList } = useTodayBookingsSimple(10);

  const weeklySparkBooked = useMemo(() => {
    if (!weeklyTrendsData) return [] as Array<{ x: string; y: number }>;
    return (weeklyTrendsData as DailyData[]).map((d) => ({ x: d.day, y: Number(d.total || 0) }));
  }, [weeklyTrendsData]);
  const weeklySparkCompleted = useMemo(() => {
    if (!weeklyTrendsData) return [] as Array<{ x: string; y: number }>;
    return (weeklyTrendsData as DailyData[]).map((d) => ({ x: d.day, y: Number(d.completed || 0) }));
  }, [weeklyTrendsData]);
  const weekTotals = useMemo(() => {
    if (!weeklyTrendsData) return { total: 0, completed: 0, noShow: 0, approved: 0, rejected: 0 };
    return (weeklyTrendsData as DailyData[]).reduce(
      (acc, d) => ({
        total: acc.total + Number(d.total || 0),
        completed: acc.completed + Number(d.completed || 0),
        noShow: acc.noShow + Number(d.noShow || 0),
        approved: acc.approved + Number(d.approved || 0),
        rejected: acc.rejected + Number(d.rejected || 0),
      }),
      { total: 0, completed: 0, noShow: 0, approved: 0, rejected: 0 }
    );
  }, [weeklyTrendsData]);

  // Smooth single-series trend of total bookings per day.
  const weeklyChartData = useMemo(() => {
    return ((weeklyTrendsData as DailyData[] | undefined) ?? []).map((d) => ({
      day: d.day,
      total: Number(d.total || 0),
    }));
  }, [weeklyTrendsData]);

  // Capacity is the largest session quota (used by the occupancy gauge + banner),
  // not a hard-coded 15.
  const maxQuota = useMemo(() => {
    const qs = (sessionsToday || []).map((s) => Number(s.quota || 0)).filter((n) => n > 0);
    return qs.length ? Math.max(...qs) : 15;
  }, [sessionsToday]);
  const occ = Number(occupancy || 0);
  const almostFull = occ >= Math.ceil(0.8 * maxQuota);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LayoutDashboard className="h-5 w-5" />
              </span>
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
            {lastUpdated ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Last updated: {format(lastUpdated, 'HH:mm:ss')}{isRefreshing ? ' • refreshing…' : ''}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <Button variant="outline" onClick={() => navigate('/live_gym')}>
              <Users className="h-4 w-4 mr-2" /> Live Gym
            </Button>
            <Button onClick={() => navigate('/schedules')}>
              <Calendar className="h-4 w-4 mr-2" /> Manage Schedules
            </Button>
            <Button variant="outline" onClick={() => { refetchOccupancy(); refetchStats(); }} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Auto Refresh</Label>
              <Select value={autoRefresh ? String(refreshInterval) : 'off'} onValueChange={(v) => {
                if (v === 'off') { setAutoRefresh(false); } else { setAutoRefresh(true); setRefreshInterval(Number(v)); }
              }}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="30000">30s</SelectItem>
                  <SelectItem value="60000">60s</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {occupancyLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <OccupancyCard currentOccupancy={occ} maxCapacity={maxQuota} isLoading={occupancyLoading} />
          )}
          {isLoading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : (
            <>
              <StatCard title="Booked Today" value={todayStats?.booked || 0} icon={Calendar} variant="info" badgeText="Week" sparklineData={weeklySparkBooked} onClick={() => { setDrawerType('booked'); setDrawerOpen(true); }} />
              <StatCard title="Completed Today" value={todayStats?.completed || 0} icon={CheckCircle} variant="success" badgeText="Week" sparklineData={weeklySparkCompleted} onClick={() => navigate('/reports')} />
              <StatCard title="Approved Today" value={todayStats?.approved || 0} icon={CheckCircle} variant="info" onClick={() => navigate('/gym_booking')} />
            </>
          )}
        </div>

        {almostFull ? (
          <div className="rounded-xl border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-3 flex items-center justify-between">
            <div className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Gym hampir penuh — {occ}/{maxQuota} orang di dalam
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/live_gym')}>Periksa Live Gym</Button>
          </div>
        ) : null}

        {/* Week-to-date rates */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Minggu ini ({weekTotals.total} booking):</span>
          <Badge variant="secondary">Approved {weekTotals.total ? Math.round((weekTotals.approved / weekTotals.total) * 100) : 0}%</Badge>
          <Badge variant="secondary">Rejected {weekTotals.total ? Math.round((weekTotals.rejected / weekTotals.total) * 100) : 0}%</Badge>
          <Badge variant="secondary">No-show {weekTotals.total ? Math.round((weekTotals.noShow / weekTotals.total) * 100) : 0}%</Badge>
        </div>

        {/* Sessions today + weekly trend */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Dumbbell className="h-4 w-4" />
                </span>
                Sesi Hari Ini
              </CardTitle>
              <CardDescription>Booking & kehadiran per sesi</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {breakdownLoading ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : (sessionsToday || []).length === 0 ? (
                <div className="text-sm text-muted-foreground">Tidak ada sesi aktif untuk hari ini.</div>
              ) : (
                (sessionsToday as SessionToday[]).map((s) => {
                  const quota = Math.max(0, Number(s.quota || 0));
                  const pct = quota > 0 ? Math.min(100, Math.round((s.booked / quota) * 100)) : 0;
                  const barColor = s.booked >= quota && quota > 0 ? 'bg-rose-500' : s.booked >= Math.ceil(0.8 * quota) ? 'bg-amber-500' : 'bg-emerald-500';
                  return (
                    <div key={s.schedule_id || s.time_start}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {titleCase(s.session_name) || 'Sesi'}{' '}
                          <span className="text-muted-foreground font-normal">{sessionTimeLabel(s)}</span>
                        </span>
                        <span className="font-mono tabular-nums">{s.booked}/{quota}</span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="h-3 w-3" /> {s.checkedIn} hadir
                        </span>
                        {s.noShow > 0 ? <span className="text-rose-600 dark:text-rose-400">{s.noShow} no-show</span> : null}
                        <span>Sisa {Math.max(0, quota - s.booked)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </span>
                Gender Hari Ini
              </CardTitle>
              <CardDescription>Sebaran gender booking aktif hari ini</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {breakdownLoading ? (
                <Skeleton className="h-[180px] w-full" />
              ) : (
                <DonutBreakdown
                  items={[
                    { label: 'Pria', value: gender.male, hex: '#3b82f6', dot: 'bg-blue-500' },
                    { label: 'Wanita', value: gender.female, hex: '#ec4899', dot: 'bg-pink-500' },
                    { label: 'Lainnya', value: gender.unknown, hex: '#94a3b8', dot: 'bg-slate-400' },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status breakdown + weekly trend */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Activity className="h-4 w-4" />
                </span>
                Status Hari Ini
              </CardTitle>
              <CardDescription>Sebaran status booking hari ini</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {statsLoading ? (
                <Skeleton className="h-[180px] w-full" />
              ) : (
                <DonutBreakdown
                  items={[
                    { label: 'Booked', value: todayStats?.booked || 0, hex: '#f59e0b', dot: 'bg-amber-500' },
                    { label: 'Inside', value: todayStats?.checkin || 0, hex: '#22c55e', dot: 'bg-green-500' },
                    { label: 'Completed', value: todayStats?.completed || 0, hex: '#3b82f6', dot: 'bg-blue-500' },
                    { label: 'No-show', value: todayStats?.noShow || 0, hex: '#ef4444', dot: 'bg-red-500' },
                  ]}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BarChart3 className="h-4 w-4" />
                </span>
                Tren Booking Minggu Ini
              </CardTitle>
              <CardDescription>Total booking per hari (minggu ini)</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[300px]">
                {weeklyLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyChartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="weeklyTrendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} width={28} tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="total" name="Total booking" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#weeklyTrendFill)" dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="Cari perintah..." />
          <CommandList>
            <CommandEmpty>Tidak ada hasil</CommandEmpty>
            <CommandGroup heading="Navigasi">
              <CommandItem onSelect={() => { navigate('/live_gym'); setCommandOpen(false); }}>
                Live Gym
                <CommandShortcut>G</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => { navigate('/gym_booking'); setCommandOpen(false); }}>
                Booking
                <CommandShortcut>B</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => { navigate('/schedules'); setCommandOpen(false); }}>
                Schedules
                <CommandShortcut>S</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => { navigate('/reports'); setCommandOpen(false); }}>
                Reports
                <CommandShortcut>R</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Refresh">
              <CommandItem onSelect={() => { setAutoRefresh(false); setCommandOpen(false); }}>Matikan auto-refresh</CommandItem>
              <CommandItem onSelect={() => { setAutoRefresh(true); setRefreshInterval(30000); setCommandOpen(false); }}>Auto-refresh 30s</CommandItem>
              <CommandItem onSelect={() => { setAutoRefresh(true); setRefreshInterval(60000); setCommandOpen(false); }}>Auto-refresh 60s</CommandItem>
              <CommandItem onSelect={() => { refetchOccupancy(); refetchStats(); setCommandOpen(false); }}>Refresh data sekarang</CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{drawerType === 'booked' ? 'Booked Hari Ini (10 terdekat)' : 'Detail'}</DrawerTitle>
            </DrawerHeader>
            <div className="p-4">
              {drawerType === 'booked' ? (
                <div className="space-y-2">
                  {(bookedList || []).map((b) => (
                    <div key={b.id} className="row-interactive rounded-md border p-2 flex items-center justify-between">
                      <div className="text-sm">{b.employee_name || b.employee_id} • {b.session_name || '-'} • {b.time_start || '-'}</div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/schedules?filter=today')}>Buka</Button>
                    </div>
                  ))}
                  {(!bookedList || bookedList.length === 0) && (
                    <div className="text-sm text-muted-foreground">Tidak ada data</div>
                  )}
                </div>
              ) : null}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </AppLayout>
  );
}
