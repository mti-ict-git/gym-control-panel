import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useGymSchedules, useAddSchedule, useUpdateSchedule, useDeleteSchedule, FilterType, GymScheduleWithUser } from '@/hooks/useGymSchedules';
import { GYM_SESSIONS, getSessionByTime, formatSessionTime } from '@/lib/gymSessions';
import { ScheduleDialog } from '@/components/schedules/ScheduleDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { toast } from 'sonner';

export default function SchedulesPage() {
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<GymScheduleWithUser | null>(null);
  const [deleteSchedule, setDeleteSchedule] = useState<GymScheduleWithUser | null>(null);

  useEffect(() => {
    const filterParam = searchParams.get('filter') as FilterType;
    if (filterParam) {
      setFilter(filterParam);
    }
  }, [searchParams]);

  const { data: schedules, isLoading } = useGymSchedules(filter);
  const createMutation = useAddSchedule();
  const updateMutation = useUpdateSchedule();
  const deleteMutation = useDeleteSchedule();

  const filterButtons: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'In Gym', value: 'IN_GYM' },
    { label: 'Booked', value: 'BOOKED' },
    { label: 'Out', value: 'OUT' },
  ];

  const handleCreate = () => {
    setEditingSchedule(null);
    setDialogOpen(true);
  };

  const handleEdit = (schedule: GymScheduleWithUser) => {
    setEditingSchedule(schedule);
    setDialogOpen(true);
  };

  const handleSubmit = (data: { gym_user_id: string; schedule_time: string }) => {
    if (editingSchedule) {
      updateMutation.mutate(
        { scheduleId: editingSchedule.id, schedule_time: data.schedule_time },
        {
          onSuccess: () => {
            toast.success('Schedule updated');
            setDialogOpen(false);
          },
          onError: () => toast.error('Failed to update schedule'),
        }
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success('Schedule created');
          setDialogOpen(false);
        },
        onError: () => toast.error('Failed to create schedule'),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteSchedule) return;
    deleteMutation.mutate(deleteSchedule.id, {
      onSuccess: () => {
        toast.success('Schedule deleted');
        setDeleteSchedule(null);
      },
      onError: () => toast.error('Failed to delete schedule'),
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Schedules</h1>
            <p className="text-muted-foreground">View and manage gym session occupancy.</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Schedule
          </Button>
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
                  <TableHead className="w-16">No</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule, index) => {
                  const scheduleDate = new Date(schedule.schedule_time);
                  const session = getSessionByTime(scheduleDate);
                  return (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{schedule.gym_users?.name || 'Unknown'}</span>
                          <span className="text-xs text-muted-foreground">
                            {schedule.gym_users?.employee_id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{format(scheduleDate, 'MMM d, yyyy')}</span>
                          <span className="text-xs text-muted-foreground">
                            {session ? formatSessionTime(session) : format(scheduleDate, 'HH:mm')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={schedule.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {schedule.status === 'BOOKED' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(schedule)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteSchedule(schedule)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            icon={Calendar}
            title="No sessions found"
            description="No gym sessions data available for the selected filter."
            action={
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Schedule
              </Button>
            }
          />
        )}
      </div>

      <ScheduleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        schedule={editingSchedule}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!deleteSchedule} onOpenChange={() => setDeleteSchedule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this schedule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
