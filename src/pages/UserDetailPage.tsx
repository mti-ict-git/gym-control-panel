import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Plus, Trash2, User, LogIn, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useGymUser } from '@/hooks/useGymUsers';
import { useUserSchedules, useAddSchedule, useDeleteSchedule, useCheckIn, useCheckOut, useGymOccupancy } from '@/hooks/useGymSchedules';
import { cn } from '@/lib/utils';

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: user, isLoading: userLoading } = useGymUser(userId);
  const { data: schedules, isLoading: schedulesLoading } = useUserSchedules(userId);
  const { data: occupancy } = useGymOccupancy();
  const addScheduleMutation = useAddSchedule();
  const deleteScheduleMutation = useDeleteSchedule();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);
  const [showCapacityAlert, setShowCapacityAlert] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState('09:00');

  if (userLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-40" />
          <Skeleton className="h-60" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <EmptyState
          icon={User}
          title="User not found"
          description="The user you're looking for doesn't exist."
          action={
            <Button onClick={() => navigate('/users')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
          }
        />
      </AppLayout>
    );
  }

  const handleAddSchedule = () => {
    if (!selectedDate) {
      toast({
        title: "Validation Error",
        description: "Please select a date.",
        variant: "destructive",
      });
      return;
    }

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduleTime = new Date(selectedDate);
    scheduleTime.setHours(hours, minutes, 0, 0);

    addScheduleMutation.mutate(
      { gym_user_id: user.id, schedule_time: scheduleTime.toISOString() },
      {
        onSuccess: () => {
          setIsAddDialogOpen(false);
          setSelectedDate(new Date());
          setSelectedTime('09:00');
        },
      }
    );
  };

  const handleDeleteSchedule = () => {
    if (deleteScheduleId) {
      deleteScheduleMutation.mutate(deleteScheduleId, {
        onSuccess: () => {
          setDeleteScheduleId(null);
        },
      });
    }
  };

  const handleCheckIn = async (scheduleId: string) => {
    if ((occupancy || 0) >= 15) {
      setShowCapacityAlert(true);
      return;
    }
    
    try {
      await checkInMutation.mutateAsync(scheduleId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'GYM_FULL') {
        setShowCapacityAlert(true);
      }
    }
  };

  const handleCheckOut = (scheduleId: string) => {
    checkOutMutation.mutate(scheduleId);
  };

  const sortedSchedules = [...(schedules || [])].sort(
    (a, b) => new Date(b.schedule_time).getTime() - new Date(a.schedule_time).getTime()
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/users')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{user.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employee ID</p>
                <p className="font-medium">{user.employee_id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="schedules">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="schedules" className="touch-target">
              <Calendar className="h-4 w-4 mr-2" />
              Schedules
            </TabsTrigger>
          </TabsList>
          <TabsContent value="schedules" className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Schedule History</h3>
              <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Schedule
              </Button>
            </div>

            {schedulesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : sortedSchedules.length > 0 ? (
              <div className="rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSchedules.map((schedule) => {
                      const scheduleDate = new Date(schedule.schedule_time);
                      return (
                        <TableRow key={schedule.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{format(scheduleDate, 'MMM d, yyyy')}</p>
                              <p className="text-sm text-muted-foreground">{format(scheduleDate, 'h:mm a')}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={schedule.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              {schedule.status === 'BOOKED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCheckIn(schedule.id)}
                                  disabled={checkInMutation.isPending}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <LogIn className="h-4 w-4 mr-1" />
                                  Check In
                                </Button>
                              )}
                              {schedule.status === 'IN_GYM' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCheckOut(schedule.id)}
                                  disabled={checkOutMutation.isPending}
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                >
                                  <LogOut className="h-4 w-4 mr-1" />
                                  Check Out
                                </Button>
                              )}
                              {schedule.status === 'BOOKED' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteScheduleId(schedule.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
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
                title="No schedules"
                description="This user has no scheduled sessions."
                action={
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schedule
                  </Button>
                }
              />
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Schedule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal touch-target">
                      <Calendar className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="touch-target"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSchedule} disabled={addScheduleMutation.isPending}>
                {addScheduleMutation.isPending ? 'Adding...' : 'Add Schedule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteScheduleId} onOpenChange={() => setDeleteScheduleId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this schedule? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteSchedule} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteScheduleMutation.isPending}
              >
                {deleteScheduleMutation.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showCapacityAlert} onOpenChange={setShowCapacityAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-600">Gym is Full</AlertDialogTitle>
              <AlertDialogDescription>
                The gym has reached maximum capacity (15/15). Please wait until someone checks out before checking in this user.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowCapacityAlert(false)}>
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
