import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Clock, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { gymUsers, getTodaySchedules, getUpcomingSchedules, getUserById } from '@/data/mockData';

export default function DashboardPage() {
  const navigate = useNavigate();
  const todaySchedules = getTodaySchedules();
  const upcomingSchedules = getUpcomingSchedules().slice(0, 5);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, here's what's happening today.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Total Gym Users"
            value={gymUsers.length}
            icon={Users}
            onClick={() => navigate('/users')}
          />
          <StatCard
            title="Today's Schedules"
            value={todaySchedules.length}
            icon={Calendar}
            onClick={() => navigate('/schedules?filter=today')}
          />
          <StatCard
            title="Upcoming Schedules"
            value={upcomingSchedules.length}
            icon={Clock}
            onClick={() => navigate('/schedules')}
          />
        </div>

        <Card className="card-interactive" onClick={() => navigate('/schedules')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-medium">Upcoming Schedules</CardTitle>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingSchedules.length > 0 ? (
              <div className="space-y-3">
                {upcomingSchedules.map((schedule) => {
                  const user = getUserById(schedule.gymUserId);
                  const scheduleDate = new Date(schedule.scheduleTime);
                  return (
                    <div 
                      key={schedule.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{user?.name}</p>
                        <p className="text-sm text-muted-foreground">{user?.employeeId}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{format(scheduleDate, 'MMM d')}</p>
                        <p className="text-sm text-muted-foreground">{format(scheduleDate, 'h:mm a')}</p>
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
