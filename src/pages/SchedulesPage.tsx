import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useGymSchedules, FilterType } from '@/hooks/useGymSchedules';

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

  const filterButtons: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'In Gym', value: 'IN_GYM' },
    { label: 'Booked', value: 'BOOKED' },
    { label: 'Out', value: 'OUT' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Schedules</h1>
          <p className="text-muted-foreground">View and manage all gym schedules.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterButtons.map((btn) => (
            <Button
              key={btn.value}
              variant={filter === btn.value ? 'default' : 'outline'}
              onClick={() => setFilter(btn.value)}
              className="touch-target"
              size="sm"
            >
              {btn.label}
            </Button>
          ))}
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
                  <TableHead>Date & Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
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
                      <TableCell>
                        <div>
                          <p className="font-medium">{format(scheduleDate, 'MMM d, yyyy')}</p>
                          <p className="text-sm text-muted-foreground">{format(scheduleDate, 'h:mm a')}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{schedule.gym_users?.name || 'Unknown'}</TableCell>
                      <TableCell>
                        <StatusBadge status={schedule.status} />
                      </TableCell>
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
                : filter === 'IN_GYM'
                ? "No one is currently in the gym."
                : filter === 'BOOKED'
                ? "No booked schedules."
                : filter === 'OUT'
                ? "No completed sessions."
                : "No schedules have been created yet."
            }
          />
        )}
      </div>
    </AppLayout>
  );
}
