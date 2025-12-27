import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScheduleDialog } from '@/components/schedules/ScheduleDialog';
import { 
  useGymSchedules, 
  useAddSchedule, 
  useUpdateSchedule, 
  useDeleteSchedule,
  FilterType,
  GymScheduleWithUser 
} from '@/hooks/useGymSchedules';
import { getSessionByTime, formatSessionTime } from '@/lib/gymSessions';

export default function SchedulesPage() {
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<GymScheduleWithUser | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);

  useEffect(() => {
    const filterParam = searchParams.get('filter') as FilterType;
    if (filterParam) {
      setFilter(filterParam);
    }
  }, [searchParams]);

  const { data: schedules, isLoading } = useGymSchedules(filter);
  const addSchedule = useAddSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();

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

  const handleDelete = (scheduleId: string) => {
    setDeletingScheduleId(scheduleId);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (data: { gym_user_id: string; schedule_time: string }) => {
    if (editingSchedule) {
      updateSchedule.mutate(
        { scheduleId: editingSchedule.id, schedule_time: data.schedule_time },
        { onSuccess: () => setDialogOpen(false) }
      );
    } else {
      addSchedule.mutate(data, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const confirmDelete = () => {
    if (deletingScheduleId) {
      deleteSchedule.mutate(deletingScheduleId, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setDeletingScheduleId(null);
        }
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Schedules</h1>
            <p className="text-muted-foreground">View and manage gym schedules.</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Schedule
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
                  <TableHead>Session</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule, index) => {
                  const session = getSessionByTime(new Date(schedule.schedule_time));
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
                        {session ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{session.nameId}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatSessionTime(session)}
                            </span>
                          </div>
                        ) : (
                          format(new Date(schedule.schedule_time), 'HH:mm')
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(schedule.schedule_time), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <StatusBadge status={schedule.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(schedule)}
                            disabled={schedule.status !== 'BOOKED'}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(schedule.id)}
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
            title="No schedules found"
            description="No gym schedules available for the selected filter."
            action={
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Schedule
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
        isLoading={addSchedule.isPending || updateSchedule.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this schedule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
