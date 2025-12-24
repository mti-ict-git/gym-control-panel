import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Clock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/StatCard';
import { OccupancyCard } from '@/components/OccupancyCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGymUsers } from '@/hooks/useGymUsers';
import { useUpcomingSchedules, useTodaySchedulesCount, useGymOccupancy } from '@/hooks/useGymSchedules';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: users, isLoading: usersLoading } = useGymUsers();
  const { data: upcomingSchedules, isLoading: schedulesLoading } = useUpcomingSchedules(5);
  const { data: todayCount, isLoading: todayLoading } = useTodaySchedulesCount();
  const { data: occupancy, isLoading: occupancyLoading } = useGymOccupancy();

  const isLoading = usersLoading || schedulesLoading || todayLoading;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, here's what's happening today.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            </>
          ) : (
            <>
              <StatCard
                title="Total Gym Users"
                value={users?.length || 0}
                icon={Users}
                onClick={() => navigate('/users')}
              />
              <StatCard
                title="Today's Schedules"
                value={todayCount || 0}
                icon={Calendar}
                onClick={() => navigate('/schedules?filter=today')}
              />
              <StatCard
                title="Upcoming Schedules"
                value={upcomingSchedules?.length || 0}
                icon={Clock}
                onClick={() => navigate('/schedules')}
              />
            </>
          )}
        </div>

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
