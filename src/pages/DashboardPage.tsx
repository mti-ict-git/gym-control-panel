import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Clock, ArrowRight, BarChart3, LayoutDashboard, Database, FileText, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/StatCard';
import { OccupancyCard } from '@/components/OccupancyCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty, CommandSeparator, CommandShortcut } from '@/components/ui/command';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { useGymUsers } from '@/hooks/useGymUsers';
import { useUpcomingSchedules, useTodaySchedulesCount, useGymOccupancy, useTodayBookingStats, usePendingApprovalsList, useTodayBookingsSimple } from '@/hooks/useGymSchedules';
import { usePeakHoursData, useWeeklyTrendsData, useOccupancyPatternData, useMonthlyStats, usePeakHoursHeatmapData } from '@/hooks/useGymAnalytics';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: upcomingSchedules, isLoading: schedulesLoading } = useUpcomingSchedules(5);
  const { data: todayCount, isLoading: todayLoading } = useTodaySchedulesCount();

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
  
  
  // Analytics data
  const { data: peakHoursData, isLoading: peakLoading } = usePeakHoursData();
  const { data: weeklyTrendsData, isLoading: weeklyLoading } = useWeeklyTrendsData();
  const { data: occupancyPatternData, isLoading: patternLoading } = useOccupancyPatternData();
  const { data: monthlyStats, isLoading: monthlyLoading } = useMonthlyStats();
  const { data: heatmapData, isLoading: heatmapLoading } = usePeakHoursHeatmapData();

  const isLoading = schedulesLoading || todayLoading || occupancyLoading || statsLoading;

  const lastUpdated = useMemo(() => {
    const t = Math.max(Number(occupancyUpdatedAt || 0), Number(statsUpdatedAt || 0));
    return t ? new Date(t) : null;
  }, [occupancyUpdatedAt, statsUpdatedAt]);

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
  const [drawerType, setDrawerType] = useState<'pending' | 'booked' | null>(null);
  const { data: approvalsList } = usePendingApprovalsList(10);
  const { data: bookedList } = useTodayBookingsSimple(10);

  const isRefreshing = occupancyFetching || statsFetching;

  type WeeklyTrendsRow = { day: string; total: number; completed: number; noShow: number; approved: number; rejected: number };

  const weeklySparkBooked = useMemo(() => {
    if (!weeklyTrendsData) return [] as Array<{ x: string; y: number }>;
    return (weeklyTrendsData as WeeklyTrendsRow[]).map((d) => ({ x: d.day, y: Number(d.total || 0) }));
  }, [weeklyTrendsData]);
  const weeklySparkCompleted = useMemo(() => {
    if (!weeklyTrendsData) return [] as Array<{ x: string; y: number }>;
    return (weeklyTrendsData as WeeklyTrendsRow[]).map((d) => ({ x: d.day, y: Number(d.completed || 0) }));
  }, [weeklyTrendsData]);
  const weekTotals = useMemo(() => {
    if (!weeklyTrendsData) return { total: 0, completed: 0, noShow: 0, approved: 0, rejected: 0 };
    return (weeklyTrendsData as WeeklyTrendsRow[]).reduce((acc, d) => ({
      total: acc.total + Number(d.total || 0),
      completed: acc.completed + Number(d.completed || 0),
      noShow: acc.noShow + Number(d.noShow || 0),
      approved: acc.approved + Number(d.approved || 0),
      rejected: acc.rejected + Number(d.rejected || 0),
    }), { total: 0, completed: 0, noShow: 0, approved: 0, rejected: 0 });
  }, [weeklyTrendsData]);

  return (
    <AppLayout>
      <div className="space-y-6">

        <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 md:-mb-6">
          <Card className="flex w-full flex-col rounded-none md:min-h-[calc(100svh-3.5rem)] md:rounded-lg md:rounded-t-none md:border-t-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Dashboard</h1>
                  <p className="text-muted-foreground">{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
                </div>
                <div className="hidden md:flex items-center gap-3">
                  <Button variant="outline" onClick={() => navigate('/live_gym')}>
                    <Users className="h-4 w-4 mr-2" /> Live Gym
                  </Button>
                  <Button onClick={() => navigate('/schedules')}>
                    <Calendar className="h-4 w-4 mr-2" /> Manage Schedules
                  </Button>
                <Button variant="outline" onClick={() => { refetchOccupancy(); refetchStats(); }} disabled={isRefreshing}>
                  <RefreshCw className="h-4 w-4 mr-2" /> {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Auto Refresh</Label>
                    <Select value={autoRefresh ? String(refreshInterval) : 'off'} onValueChange={(v) => {
                      if (v === 'off') { setAutoRefresh(false); } else { setAutoRefresh(true); setRefreshInterval(Number(v)); }
                    }}>
                      <SelectTrigger className="w-[120px]">
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
              <CardTitle className="text-2xl flex items-center gap-2">
                <Database className="h-6 w-6" />
                Gym Booking Overview
              </CardTitle>
              <CardDescription>Ringkasan booking hari ini & antrian approval</CardDescription>
              {lastUpdated ? (
                <div className="mt-2 text-xs text-muted-foreground">Last updated: {format(lastUpdated, 'HH:mm:ss')}{isRefreshing ? ' • refreshing…' : ''}</div>
              ) : null}
            </CardHeader>
            <CardContent className="flex-1">
              
              <div className="h-6" />
              <div className="grid gap-5 md:gap-6 md:grid-cols-3 lg:grid-cols-6">
                {occupancyLoading ? (
                  <Skeleton className="h-32 md:col-span-2 lg:col-span-1" />
                ) : (
                  <OccupancyCard 
                    currentOccupancy={occupancy || 0} 
                    isLoading={occupancyLoading}
                  />
                )}

                {isLoading ? (
                  <>
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                  </>
                ) : (
                  <>
                    <StatCard title="Booked Today" value={todayStats?.booked || 0} icon={Calendar} variant="info" badgeText="This Week" sparklineData={weeklySparkBooked} onClick={() => { setDrawerType('booked'); setDrawerOpen(true); }} />
                    <StatCard title="In Gym Now" value={occupancy || 0} icon={Users} variant="success" onClick={() => navigate('/live_gym')} />
                    <StatCard title="Completed Today" value={todayStats?.completed || 0} icon={CheckCircle} variant="success" badgeText="This Week" sparklineData={weeklySparkCompleted} onClick={() => navigate('/reports')} />
                    <StatCard title="Pending Approvals" value={todayStats?.pending || 0} icon={Clock} variant="warning" onClick={() => { setDrawerType('pending'); setDrawerOpen(true); }} />
                    <StatCard title="Approved Today" value={todayStats?.approved || 0} icon={CheckCircle} variant="info" onClick={() => navigate('/gym_booking')} />
                    <StatCard title="Rejected Today" value={todayStats?.rejected || 0} icon={XCircle} variant="destructive" onClick={() => navigate('/gym_booking')} />
                  </>
                )}
              </div>

              {Number(occupancy || 0) >= 12 || Number(occupancy || 0) >= Math.round(0.8 * 15) ? (
                <div className="mt-4 rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-3 flex items-center justify-between">
                  <div className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Almost Full</div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/live_gym')}>Periksa Live Gym</Button>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Approved rate: {weekTotals.total ? Math.round((weekTotals.approved / weekTotals.total) * 100) : 0}%</Badge>
                <Badge variant="secondary">Rejected rate: {weekTotals.total ? Math.round((weekTotals.rejected / weekTotals.total) * 100) : 0}%</Badge>
                <Badge variant="secondary">No-show rate: {weekTotals.total ? Math.round((weekTotals.noShow / weekTotals.total) * 100) : 0}%</Badge>
              </div>

              <div className="h-6" />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="heatmap" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="peak-hours">Peak Hours</TabsTrigger>
                      <TabsTrigger value="weekly-trends">Weekly Trends</TabsTrigger>
                      <TabsTrigger value="occupancy-pattern">Occupancy Pattern</TabsTrigger>
                      <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="peak-hours" className="mt-4">
                      <div className="h-[300px]">
                        {peakLoading ? (
                          <Skeleton className="h-full w-full" />
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={peakHoursData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis 
                                dataKey="hour" 
                                tick={{ fontSize: 12 }}
                                className="text-muted-foreground"
                              />
                              <YAxis 
                                tick={{ fontSize: 12 }}
                                className="text-muted-foreground"
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                                labelStyle={{ color: 'hsl(var(--foreground))' }}
                              />
                              <Bar 
                                dataKey="count" 
                                fill="hsl(var(--primary))" 
                                radius={[4, 4, 0, 0]}
                                name="Bookings"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        Today's bookings by hour
                      </p>
                    </TabsContent>

                    <TabsContent value="weekly-trends" className="mt-4">
                      <div className="h-[300px]">
                        {weeklyLoading ? (
                          <Skeleton className="h-full w-full" />
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyTrendsData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis 
                                dataKey="day" 
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                              />
                              <Bar 
                                dataKey="total" 
                                fill="hsl(var(--primary))" 
                                radius={[4, 4, 0, 0]}
                                name="Total Bookings"
                              />
                              <Bar 
                                dataKey="completed" 
                                fill="hsl(var(--chart-2))" 
                                radius={[4, 4, 0, 0]}
                                name="Completed"
                              />
                              <Bar 
                                dataKey="noShow" 
                                fill="hsl(var(--destructive))" 
                                radius={[4, 4, 0, 0]}
                                name="No Show"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        This week's attendance breakdown
                      </p>
                    </TabsContent>

                    <TabsContent value="occupancy-pattern" className="mt-4">
                      <div className="h-[300px]">
                        {patternLoading ? (
                          <Skeleton className="h-full w-full" />
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={occupancyPatternData}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis 
                                dataKey="time" 
                                tick={{ fontSize: 12 }}
                              />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="avgOccupancy" 
                                stroke="hsl(var(--primary))"
                                fill="hsl(var(--primary)/0.2)"
                                name="Avg Occupancy"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        Average occupancy by hour (last 7 days)
                      </p>
                    </TabsContent>

                    <TabsContent value="heatmap" className="mt-4">
                      {heatmapLoading ? (
                        <Skeleton className="h-[300px] w-full" />
                      ) : heatmapData ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-[800px] w-full border rounded-md">
                            <thead>
                              <tr>
                                <th className="p-2 text-sm text-left">Day/Hour</th>
                                {heatmapData.hours.map((h) => (
                                  <th key={h} className="p-2 text-xs text-muted-foreground text-center">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {heatmapData.days.map((d) => (
                                <tr key={d}>
                                  <td className="p-2 text-sm font-medium">{d}</td>
                                  {heatmapData.hours.map((h) => {
                                    const cell = heatmapData.cells.find((c) => c.day === d && c.hour === h);
                                    const cnt = Number(cell?.count || 0);
                                    const intensity = Math.min(1, cnt / 8);
                                    const bg = `rgba(59,130,246,${0.08 + intensity * 0.6})`;
                                    return (
                                      <td key={`${d}-${h}`} className="p-2 text-xs text-center border" style={{ backgroundColor: bg }}>
                                        {cnt}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No data</div>
                      )}
                      <p className="text-sm text-muted-foreground mt-2 text-center">
                        Kepadatan booking mingguan per jam
                      </p>
                    </TabsContent>
                  </Tabs>
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
                    <DrawerTitle>{drawerType === 'pending' ? 'Pending Approvals (10 terbaru)' : drawerType === 'booked' ? 'Booked Hari Ini (10 terdekat)' : 'Detail'}</DrawerTitle>
                  </DrawerHeader>
                  <div className="p-4">
                    {drawerType === 'pending' ? (
                      <div className="space-y-2">
                        {(approvalsList || []).map((b) => (
                          <div key={b.id} className="row-interactive rounded-md border p-2 flex items-center justify-between">
                            <div className="text-sm">{b.employee_name || b.employee_id} • {b.session_name || '-'} • {b.time_start || '-'}</div>
                            <Button variant="outline" size="sm" onClick={() => navigate('/gym_booking')}>Buka</Button>
                          </div>
                        ))}
                        {(!approvalsList || approvalsList.length === 0) && (
                          <div className="text-sm text-muted-foreground">Tidak ada data</div>
                        )}
                      </div>
                    ) : drawerType === 'booked' ? (
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

              
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
