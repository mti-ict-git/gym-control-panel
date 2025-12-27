import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GymSession, GymSessionInsert } from '@/hooks/useGymSessions';

interface SessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: GymSessionInsert) => void;
  session?: GymSession | null;
  isLoading?: boolean;
}

export function SessionDialog({ open, onOpenChange, onSubmit, session, isLoading }: SessionDialogProps) {
  const [sessionName, setSessionName] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [quota, setQuota] = useState(15);

  useEffect(() => {
    if (session) {
      setSessionName(session.session_name);
      // Convert time from HH:MM:SS to HH:MM for input
      setTimeStart(session.time_start.slice(0, 5));
      setTimeEnd(session.time_end.slice(0, 5));
      setQuota(session.quota);
    } else {
      setSessionName('');
      setTimeStart('');
      setTimeEnd('');
      setQuota(15);
    }
  }, [session, open]);

  const handleSubmit = () => {
    if (!sessionName || !timeStart || !timeEnd || quota < 1) return;

    onSubmit({
      session_name: sessionName,
      time_start: timeStart,
      time_end: timeEnd,
      quota,
    });
  };

  const isEdit = !!session;
  const isValid = sessionName && timeStart && timeEnd && quota >= 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Session' : 'Create Session'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="session_name">Session Name</Label>
            <Input
              id="session_name"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g., Morning Session"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="time_start">Time Start</Label>
              <Input
                id="time_start"
                type="time"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time_end">Time End</Label>
              <Input
                id="time_end"
                type="time"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quota">Quota</Label>
            <Input
              id="quota"
              type="number"
              min={1}
              value={quota}
              onChange={(e) => setQuota(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
            {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
