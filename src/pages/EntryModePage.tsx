import { useState } from 'react';
import { Scan, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useGymUsers } from '@/hooks/useGymUsers';
import { useGymOccupancy, useCheckIn } from '@/hooks/useGymSchedules';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type EntryStatus = 'idle' | 'approved' | 'denied';

interface DenialReason {
  message: string;
  detail: string;
}

export default function EntryModePage() {
  const [employeeId, setEmployeeId] = useState('');
  const [status, setStatus] = useState<EntryStatus>('idle');
  const [userName, setUserName] = useState('');
  const [denialReason, setDenialReason] = useState<DenialReason | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { data: gymUsers } = useGymUsers();
  const { data: occupancy = 0 } = useGymOccupancy();
  const checkInMutation = useCheckIn();
  const { toast } = useToast();
  
  const MAX_CAPACITY = 15;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employeeId.trim()) return;
    
    setIsProcessing(true);
    
    // Find user by employee_id or vault_employee_id
    const user = gymUsers?.find(
      u => u.employee_id === employeeId.trim() || u.vault_employee_id === employeeId.trim()
    );
    
    if (!user) {
      setStatus('denied');
      setDenialReason({
        message: 'User Not Found',
        detail: 'This employee ID is not registered as a gym user.',
      });
      setIsProcessing(false);
      return;
    }
    
    // Check capacity
    if (occupancy >= MAX_CAPACITY) {
      setStatus('denied');
      setUserName(user.name);
      setDenialReason({
        message: 'Gym Full',
        detail: `Maximum capacity of ${MAX_CAPACITY} reached.`,
      });
      setIsProcessing(false);
      return;
    }
    
    // Check if user already has IN_GYM status
    const { data: existingSchedule } = await supabase
      .from('gym_schedules')
      .select('*')
      .eq('gym_user_id', user.id)
      .eq('status', 'IN_GYM')
      .maybeSingle();
    
    if (existingSchedule) {
      setStatus('denied');
      setUserName(user.name);
      setDenialReason({
        message: 'Already Inside',
        detail: 'This user is already checked into the gym.',
      });
      setIsProcessing(false);
      return;
    }
    
    // Check for booked schedule to check in, or create a walk-in entry
    const { data: bookedSchedule } = await supabase
      .from('gym_schedules')
      .select('*')
      .eq('gym_user_id', user.id)
      .eq('status', 'BOOKED')
      .order('schedule_time', { ascending: true })
      .limit(1)
      .maybeSingle();
    
    if (bookedSchedule) {
      // Check in the existing booking
      checkInMutation.mutate(bookedSchedule.id, {
        onSuccess: () => {
          setStatus('approved');
          setUserName(user.name);
          setIsProcessing(false);
        },
        onError: (error) => {
          setStatus('denied');
          setUserName(user.name);
          setDenialReason({
            message: 'Check-in Failed',
            detail: error.message,
          });
          setIsProcessing(false);
        },
      });
    } else {
      // Create a walk-in entry
      const { error } = await supabase
        .from('gym_schedules')
        .insert({
          gym_user_id: user.id,
          status: 'IN_GYM',
          schedule_time: new Date().toISOString(),
          check_in_time: new Date().toISOString(),
        });
      
      if (error) {
        setStatus('denied');
        setUserName(user.name);
        setDenialReason({
          message: 'Entry Failed',
          detail: error.message,
        });
      } else {
        setStatus('approved');
        setUserName(user.name);
        toast({
          title: 'Walk-in Entry',
          description: `${user.name} has been checked in.`,
        });
      }
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setEmployeeId('');
    setUserName('');
    setDenialReason(null);
  };

  return (
    <AppLayout>
      <div className="min-h-[70vh] flex items-center justify-center">
        {status === 'idle' && (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Scan className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Entry Mode</CardTitle>
              <CardDescription>
                Enter employee ID to check in
              </CardDescription>
              <div className="mt-2 text-sm">
                <span className={occupancy >= MAX_CAPACITY ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                  Current Occupancy: {occupancy} / {MAX_CAPACITY}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="text"
                  placeholder="Enter Employee ID"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                  className="text-center text-lg h-14 touch-target"
                  autoFocus
                  autoComplete="off"
                />
                <Button 
                  type="submit" 
                  className="w-full h-14 text-lg touch-target"
                  disabled={!employeeId.trim() || isProcessing}
                >
                  {isProcessing ? 'Processing...' : 'Check In'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {status === 'approved' && (
          <Card className="w-full max-w-md border-green-500 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-14 w-14 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-green-700 dark:text-green-400 mb-2">
                APPROVED
              </h2>
              <p className="text-xl text-green-600 dark:text-green-300 mb-8">
                Welcome, {userName}!
              </p>
              <Button 
                onClick={handleReset}
                variant="outline"
                className="touch-target"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Next Entry
              </Button>
            </CardContent>
          </Card>
        )}

        {status === 'denied' && (
          <Card className="w-full max-w-md border-destructive bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-14 w-14 text-destructive" />
              </div>
              <h2 className="text-3xl font-bold text-destructive mb-2">
                DENIED
              </h2>
              {denialReason && (
                <>
                  <p className="text-xl text-red-600 dark:text-red-300 mb-2">
                    {denialReason.message}
                  </p>
                  <p className="text-muted-foreground mb-8">
                    {denialReason.detail}
                  </p>
                </>
              )}
              <Button 
                onClick={handleReset}
                variant="outline"
                className="touch-target"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
