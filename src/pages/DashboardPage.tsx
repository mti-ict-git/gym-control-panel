import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, BarChart3, LayoutDashboard, CheckCircle, RefreshCw, Dumbbell } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
                <Skeleton className="h-24 w-full" />
              ) : gender.total === 0 ? (
                <div className="text-sm text-muted-foreground">Belum ada booking hari ini.</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    {gender.male > 0 ? <div className="bg-blue-500" style={{ width: `${Math.round((gender.male / gender.total) * 100)}%` }} /> : null}
                    {gender.female > 0 ? <div className="bg-pink-500" style={{ width: `${Math.round((gender.female / gender.total) * 100)}%` }} /> : null}
                    {gender.unknown > 0 ? <div className="bg-slate-400" style={{ width: `${Math.round((gender.unknown / gender.total) * 100)}%` }} /> : null}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-blue-500" /> Pria
                      </div>
                      <div className="text-2xl font-semibold text-blue-600 dark:text-blue-400">{gender.male}</div>
                      <div className="text-xs text-muted-foreground">{Math.round((gender.male / gender.total) * 100)}%</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-pink-500" /> Wanita
                      </div>
                      <div className="text-2xl font-semibold text-pink-600 dark:text-pink-400">{gender.female}</div>
                      <div className="text-xs text-muted-foreground">{Math.round((gender.female / gender.total) * 100)}%</div>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-slate-400" /> Lainnya
                      </div>
                      <div className="text-2xl font-semibold text-slate-600 dark:text-slate-300">{gender.unknown}</div>
                      <div className="text-xs text-muted-foreground">{Math.round((gender.unknown / gender.total) * 100)}%</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Weekly trend (full width) */}
        <Card>
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-4 w-4" />
              </span>
              Tren Booking Minggu Ini
            </CardTitle>
            <CardDescription>Total vs. selesai vs. no-show per hari</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px]">
              {weeklyLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyTrendsData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Total" />
                    <Bar dataKey="completed" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Completed" />
                    <Bar dataKey="noShow" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="No-show" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

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
