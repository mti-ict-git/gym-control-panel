import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, startOfDay } from 'date-fns';
import { CalendarIcon, Dumbbell, Loader2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { usePublicGymSessionsList } from '@/hooks/usePublicGymSessions';

const formSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required').max(50, 'Employee ID is too long'),
  sessionId: z.string().min(1, 'Please select a session'),
  date: z.date({ required_error: 'Please select a date' }),
});

type FormData = z.infer<typeof formSchema>;

export default function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: sessions, isLoading: sessionsLoading } = usePublicGymSessionsList();

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
      const { data: res, error } = await supabase.functions.invoke('public-register', {
        body: {
          employeeId: data.employeeId,
          sessionId: data.sessionId,
          date: format(data.date, 'yyyy-MM-dd'),
        },
      });

      if (error) throw error;

      const payload = res as any;
      if (!payload?.ok) {
        toast({
          title: 'Registration failed',
          description: payload?.error || 'An error occurred. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      const selectedSession = sessions?.find((s) => s.id === data.sessionId);

      toast({
        title: 'Registration successful!',
        description: `You have been registered for ${selectedSession?.session_name ?? payload.sessionName} on ${format(data.date, 'MMMM d, yyyy')}.`,
      });

      form.reset();
    } catch (error: any) {
      toast({
        title: 'Registration failed',
        description: error?.message || 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasSessions = (sessions?.length ?? 0) > 0;

  return (
    <div className="min-h-screen flex bg-slate-400/80">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 p-6">
        <div className="w-full bg-slate-100 rounded-3xl flex flex-col items-center justify-center p-12 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-72 h-72 border border-slate-300 rounded-full absolute" />
            <div className="w-96 h-96 border border-slate-300 rounded-full absolute" />
            <div className="w-[28rem] h-[28rem] border border-slate-200 rounded-full absolute" />
          </div>

          <div className="relative z-10 flex items-center justify-center mb-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <Dumbbell className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>

          <div className="absolute top-20 right-24 w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center text-amber-900 font-bold text-sm shadow-md">
            💪
          </div>
          <div className="absolute bottom-32 left-20 w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
            🏋️
          </div>
          <div className="absolute top-40 left-28 w-10 h-10 bg-green-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
            ⚡
          </div>
          <div className="absolute bottom-40 right-28 w-10 h-10 bg-purple-400 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
            🎯
          </div>

          <div className="relative z-10 text-center mt-auto">
            <h1 className="text-2xl font-semibold text-slate-800 mb-3">
              Book your gym session
              <br />
              quick and easy.
            </h1>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              Reserve your spot for tomorrow or the next day. Stay fit, stay healthy!
            </p>

            <div className="flex justify-center gap-2 mt-8">
              <div className="w-2 h-2 rounded-full bg-slate-800" />
              <div className="w-2 h-2 rounded-full bg-slate-300" />
              <div className="w-2 h-2 rounded-full bg-slate-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 p-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 lg:p-12 shadow-xl">
          <div className="flex lg:hidden justify-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
              <Dumbbell className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-slate-900">Session Registration</h2>
            <p className="text-slate-500 text-sm mt-1">Register for a gym session</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">Employee ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your Employee ID"
                        {...field}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                      />
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
                    <FormLabel className="text-slate-700">Session</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors">
                          <SelectValue placeholder={sessionsLoading ? 'Loading sessions...' : 'Select a session'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="z-[9999] bg-white">
                        {sessionsLoading ? (
                          <SelectItem value="__loading__" disabled>
                            Loading...
                          </SelectItem>
                        ) : hasSessions ? (
                          sessions!.map((session) => (
                            <SelectItem key={session.id} value={session.id}>
                              {session.session_name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__empty__" disabled>
                            No sessions available
                          </SelectItem>
                        )}
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
                    <FormLabel className="text-slate-700">Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'h-12 w-full rounded-xl border-slate-200 bg-slate-50 hover:bg-white pl-3 text-left font-normal transition-colors',
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

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold shadow-md"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Register
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
