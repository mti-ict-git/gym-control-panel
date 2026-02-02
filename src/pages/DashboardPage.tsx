import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Clock, ArrowRight, BarChart3, LayoutDashboard, Database, FileText, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/StatCard';
import { OccupancyCard } from '@/components/OccupancyCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useGymUsers } from '@/hooks/useGymUsers';
import { useUpcomingSchedules, useTodaySchedulesCount, useGymOccupancy, useGymSchedules, useTodayBookingStats, usePendingApprovalsList, useTodayBookingsSimple } from '@/hooks/useGymSchedules';
import { usePeakHoursData, useWeeklyTrendsData, useOccupancyPatternData, useMonthlyStats } from '@/hooks/useGymAnalytics';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: upcomingSchedules, isLoading: schedulesLoading } = useUpcomingSchedules(5);
  const { data: todayCount, isLoading: todayLoading } = useTodaySchedulesCount();
  const { data: occupancy, isLoading: occupancyLoading } = useGymOccupancy();
  const { data: pendingSchedules, isLoading: pendingLoading } = useGymSchedules('BOOKED');
  const { data: todayStats, isLoading: statsLoading } = useTodayBookingStats();
  const { data: pendingApprovals, isLoading: approvalsLoading } = usePendingApprovalsList(6);
  const { data: todayFeed, isLoading: feedLoading } = useTodayBookingsSimple(8);
  
  // Analytics data
  const { data: peakHoursData, isLoading: peakLoading } = usePeakHoursData();
  const { data: weeklyTrendsData, isLoading: weeklyLoading } = useWeeklyTrendsData();
  const { data: occupancyPatternData, isLoading: patternLoading } = useOccupancyPatternData();
  const { data: monthlyStats, isLoading: monthlyLoading } = useMonthlyStats();

  const isLoading = schedulesLoading || todayLoading || occupancyLoading || pendingLoading || statsLoading || approvalsLoading || feedLoading;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/live_gym')}>
              <Users className="h-4 w-4 mr-2" /> Live Gym
            </Button>
            <Button onClick={() => navigate('/schedules')}>
              <Calendar className="h-4 w-4 mr-2" /> Manage Schedules
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
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
              <StatCard title="Booked Today" value={todayStats?.booked || 0} icon={Calendar} onClick={() => navigate('/schedules?filter=today')} />
              <StatCard title="In Gym Now" value={occupancy || 0} icon={Users} onClick={() => navigate('/live_gym')} />
              <StatCard title="Completed Today" value={todayStats?.completed || 0} icon={CheckCircle} onClick={() => navigate('/reports')} />
              <StatCard title="Pending Approvals" value={todayStats?.pending || 0} icon={Clock} onClick={() => navigate('/gym_booking')} />
              <StatCard title="Approved Today" value={todayStats?.approved || 0} icon={CheckCircle} onClick={() => navigate('/gym_booking')} />
              <StatCard title="Rejected Today" value={todayStats?.rejected || 0} icon={XCircle} onClick={() => navigate('/gym_booking')} />
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="weekly-trends" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="peak-hours">Peak Hours</TabsTrigger>
                <TabsTrigger value="weekly-trends">Weekly Trends</TabsTrigger>
                <TabsTrigger value="occupancy-pattern">Occupancy Pattern</TabsTrigger>
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
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Button variant="secondary" className="w-full justify-start" onClick={() => navigate('/live_gym')}>
                <Users className="h-4 w-4 mr-2" /> Live Gym
              </Button>
              <Button variant="secondary" className="w-full justify-start" onClick={() => navigate('/gym_booking')}>
                <Database className="h-4 w-4 mr-2" /> Booking
              </Button>
              <Button variant="secondary" className="w-full justify-start" onClick={() => navigate('/schedules')}>
                <Calendar className="h-4 w-4 mr-2" /> Schedules
              </Button>
              <Button variant="secondary" className="w-full justify-start" onClick={() => navigate('/reports')}>
                <FileText className="h-4 w-4 mr-2" /> Reports
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-interactive" onClick={() => navigate('/gym_booking')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-medium">Approvals Queue</CardTitle>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {approvalsLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4,5,6].map((i) => (<Skeleton key={i} className="h-16" />))}
                </div>
              ) : (pendingApprovals && pendingApprovals.length > 0) ? (
                <div className="space-y-3">
                  {pendingApprovals.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{p.employee_name || p.employee_id}</p>
                        <p className="text-sm text-muted-foreground">{p.session_name} • {p.time_start}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No pending approvals</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Today's Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {feedLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4,5,6,7,8].map((i) => (<Skeleton key={i} className="h-12" />))}
                </div>
              ) : (todayFeed && todayFeed.length > 0) ? (
                <div className="space-y-2">
                  {todayFeed.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-2 rounded-md border">
                      <div>
                        <p className="font-medium">{b.employee_name || b.employee_id}</p>
                        <p className="text-xs text-muted-foreground">{b.session_name} • {b.time_start}</p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No bookings today</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="weekly-trends" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="peak-hours">Peak Hours</TabsTrigger>
                <TabsTrigger value="weekly-trends">Weekly Trends</TabsTrigger>
                <TabsTrigger value="occupancy-pattern">Occupancy Pattern</TabsTrigger>
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
            </Tabs>
          </CardContent>
        </Card>

        

        <Card className="card-interactive" onClick={() => navigate('/schedules')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Upcoming Schedules</CardTitle>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {schedulesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : upcomingSchedules && upcomingSchedules.length > 0 ? (
              <div className="space-y-3">
                {upcomingSchedules.map((schedule) => {
                  const scheduleDate = new Date(schedule.schedule_time);
                  return (
                    <div 
                      key={schedule.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{schedule.gym_users?.name}</p>
                          <p className="text-sm text-muted-foreground">{schedule.gym_users?.employee_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={schedule.status} />
                        <div className="text-right">
                          <p className="font-medium">{format(scheduleDate, 'MMM d')}</p>
                          <p className="text-sm text-muted-foreground">{format(scheduleDate, 'h:mm a')}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No upcoming schedules</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
