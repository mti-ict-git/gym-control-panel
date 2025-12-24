import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useGymSchedules } from '@/hooks/useGymSchedules';

type FilterType = 'all' | 'today' | 'week';

export default function SchedulesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const [filter, setFilter] = useState<FilterType>(initialFilter);

  useEffect(() => {
    const filterParam = searchParams.get('filter') as FilterType;
    if (filterParam) {
      setFilter(filterParam);
    }
  }, [searchParams]);

  const { data: schedules, isLoading } = useGymSchedules(filter);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Schedules</h1>
          <p className="text-muted-foreground">View and manage all gym schedules.</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            className="touch-target"
          >
            All
          </Button>
          <Button
            variant={filter === 'today' ? 'default' : 'outline'}
            onClick={() => setFilter('today')}
            className="touch-target"
          >
            Today
          </Button>
          <Button
            variant={filter === 'week' ? 'default' : 'outline'}
            onClick={() => setFilter('week')}
            className="touch-target"
          >
            This Week
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : schedules && schedules.length > 0 ? (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>User Name</TableHead>
                  <TableHead className="hidden md:table-cell">Employee ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => {
                  const scheduleDate = new Date(schedule.schedule_time);
                  return (
                    <TableRow 
                      key={schedule.id}
                      className="row-interactive"
                      onClick={() => navigate(`/users/${schedule.gym_user_id}`)}
                    >
                      <TableCell>{format(scheduleDate, 'MMM d, yyyy')}</TableCell>
                      <TableCell>{format(scheduleDate, 'h:mm a')}</TableCell>
                      <TableCell className="font-medium">{schedule.gym_users?.name || 'Unknown'}</TableCell>
                      <TableCell className="hidden md:table-cell">{schedule.gym_users?.employee_id || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            icon={Calendar}
            title="No schedules found"
            description={
              filter === 'today' 
                ? "No schedules for today." 
                : filter === 'week' 
                ? "No schedules for this week." 
                : "No schedules have been created yet."
            }
          />
        )}
      </div>
    </AppLayout>
  );
}
