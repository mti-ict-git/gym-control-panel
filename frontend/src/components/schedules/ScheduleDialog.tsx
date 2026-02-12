import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GYM_SESSIONS, formatSessionDisplay } from '@/lib/gymSessions';
import { useGymUsers } from '@/hooks/useGymUsers';
import { GymScheduleWithUser } from '@/hooks/useGymSchedules';

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { gym_user_id: string; schedule_time: string }) => void;
  schedule?: GymScheduleWithUser | null;
  isLoading?: boolean;
}

export function ScheduleDialog({ open, onOpenChange, onSubmit, schedule, isLoading }: ScheduleDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSession, setSelectedSession] = useState('');
  
  const { data: usersData } = useGymUsers();
  const users = usersData?.data || [];

  useEffect(() => {
    if (schedule) {
      setSelectedUserId(schedule.gym_user_id);
      const scheduleDate = new Date(schedule.schedule_time);
      setSelectedDate(scheduleDate);
      // Find matching session
      const hours = scheduleDate.getHours();
      const session = GYM_SESSIONS.find(s => {
        const [startH] = s.startTime.split(':').map(Number);
        return hours === startH;
      });
      if (session) setSelectedSession(session.id);
    } else {
      setSelectedUserId('');
      setSelectedDate(undefined);
      setSelectedSession('');
    }
  }, [schedule, open]);

  const handleSubmit = () => {
    if (!selectedUserId || !selectedDate || !selectedSession) return;
    
    const session = GYM_SESSIONS.find(s => s.id === selectedSession);
    if (!session) return;
    
    const [hours, minutes] = session.startTime.split(':').map(Number);
    const scheduleTime = new Date(selectedDate);
    scheduleTime.setHours(hours, minutes, 0, 0);
    
    onSubmit({
      gym_user_id: selectedUserId,
      schedule_time: scheduleTime.toISOString(),
    });
  };

  const isEdit = !!schedule;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Schedule' : 'Create Schedule'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="user">User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={isEdit}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.employee_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="session">Session</Label>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger>
                <SelectValue placeholder="Select a session" />
              </SelectTrigger>
              <SelectContent>
                {GYM_SESSIONS.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {formatSessionDisplay(session)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedUserId || !selectedDate || !selectedSession || isLoading}
          >
            {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
