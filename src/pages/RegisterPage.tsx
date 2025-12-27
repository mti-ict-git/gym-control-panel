import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, startOfDay } from 'date-fns';
import { CalendarIcon, Dumbbell, Loader2 } from 'lucide-react';
import { useGymSessionsList } from '@/hooks/useGymSessions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const formSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required').max(50, 'Employee ID is too long'),
  sessionId: z.string().min(1, 'Please select a session'),
  date: z.date({ required_error: 'Please select a date' }),
});

type FormData = z.infer<typeof formSchema>;

export default function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: sessions, isLoading: sessionsLoading } = useGymSessionsList();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: '',
      sessionId: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // First, find or create the gym user by employee_id
      const { data: existingUser, error: userError } = await supabase
        .from('gym_users')
        .select('id')
        .eq('employee_id', data.employeeId)
        .maybeSingle();

      if (userError) throw userError;

      if (!existingUser) {
        toast({
          title: 'Employee not found',
          description: 'Please check your Employee ID and try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Get the selected session to create schedule_time
      const selectedSession = sessions?.find(s => s.id === data.sessionId);
      if (!selectedSession) {
        toast({
          title: 'Session not found',
          description: 'Please select a valid session.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Create schedule_time by combining date with session start time
      const [hours, minutes] = selectedSession.time_start.split(':').map(Number);
      const scheduleTime = new Date(data.date);
      scheduleTime.setHours(hours, minutes, 0, 0);

      // Create the schedule
      const { error: scheduleError } = await supabase
        .from('gym_schedules')
        .insert({
          gym_user_id: existingUser.id,
          schedule_time: scheduleTime.toISOString(),
          status: 'BOOKED',
        });

      if (scheduleError) throw scheduleError;

      toast({
        title: 'Registration successful!',
        description: `You have been registered for ${selectedSession.session_name} on ${format(data.date, 'MMMM d, yyyy')}.`,
      });

      form.reset();
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: 'Registration failed',
        description: error.message || 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Dumbbell className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Gym Session Registration</CardTitle>
          <CardDescription>
            Register for a gym session by filling in the form below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your Employee ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sessionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={sessionsLoading ? 'Loading sessions...' : 'Select a session'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sessions?.map((session) => (
                          <SelectItem key={session.id} value={session.id}>
                            {session.session_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => {
                            const tomorrow = startOfDay(addDays(new Date(), 1));
                            const dayAfterTomorrow = startOfDay(addDays(new Date(), 2));
                            const dateToCheck = startOfDay(date);
                            return dateToCheck < tomorrow || dateToCheck > dayAfterTomorrow;
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Register
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
