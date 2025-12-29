import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, startOfDay } from 'date-fns';
import { CalendarIcon, Loader2, Clock, MapPin, AlertTriangle, Users } from 'lucide-react';
import gymIcon from '@/assets/gym-icon.png';
import treadmillImg from '@/assets/treadmill.png';
import benchPressImg from '@/assets/bench-press.png';
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

const carouselImages = [treadmillImg, benchPressImg, gymIcon];

export default function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: '',
      sessionId: '',
    },
  });

  const selectedDate = form.watch('date');
  const selectedSessionId = form.watch('sessionId');
  const { data: sessions, isLoading: sessionsLoading } = usePublicGymSessionsList(selectedDate);
  const selectedSession = sessions?.find((s) => s.id === selectedSessionId);

  // Auto-swipe carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

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

  // Calculate slots remaining
  const slotsRemaining = selectedSession
    ? (selectedSession.quota ?? 0) - (selectedSession.booked_count ?? 0)
    : 15;
  const maxSlots = selectedSession?.quota ?? 15;
  const progressPercentage = ((maxSlots - slotsRemaining) / maxSlots) * 100;

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-300 via-slate-200 to-slate-300">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 p-6">
        <div className="w-full bg-slate-100 rounded-3xl flex flex-col items-center justify-between p-12 relative overflow-hidden shadow-lg">
          {/* Floating circles */}
          <div className="absolute top-8 left-12 w-8 h-8 bg-green-400 rounded-full flex items-center justify-center shadow-md">
            <span className="text-white text-xs">−</span>
          </div>
          <div className="absolute top-8 right-32 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center shadow-md">
            <span className="text-amber-900 text-xs">💪</span>
          </div>
          <div className="absolute bottom-28 left-16 w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center shadow-md">
            <span className="text-white text-xs">#</span>
          </div>
          <div className="absolute bottom-28 right-20 w-8 h-8 bg-purple-400 rounded-full flex items-center justify-center shadow-md">
            <span className="text-white text-xs">●</span>
          </div>

          {/* Concentric circles */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 border border-slate-300/60 rounded-full absolute" />
            <div className="w-80 h-80 border border-slate-300/40 rounded-full absolute" />
            <div className="w-96 h-96 border border-slate-200/30 rounded-full absolute" />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Carousel - Centered on circles */}
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ marginTop: '-40px' }}>
            <div className="flex flex-col items-center">
              <div className="w-56 h-56 flex items-center justify-center relative">
                {carouselImages.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Fitness ${idx + 1}`}
                    className={`absolute w-48 h-48 object-contain transition-all duration-500 ${
                      idx === currentSlide
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-95'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          <div className="relative z-10 text-center mt-8">
            <h1 className="text-xl font-semibold text-slate-800 mb-2">
              Book your gym session
              <br />
              quick and easy.
            </h1>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              Reserve your spot for tomorrow or the next day.
              <br />
              Stay fit, stay healthy!
            </p>

            <div className="flex justify-center gap-2 mt-6">
              {carouselImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    idx === currentSlide
                      ? 'bg-slate-800'
                      : 'bg-slate-400 hover:bg-slate-500'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form & Info */}
      <div className="w-full lg:w-1/2 p-6 flex flex-col items-center justify-center gap-4 relative">
        {/* Circular Progress Indicator - Desktop only */}
        <div className="hidden lg:flex absolute top-8 right-8 flex-col items-center">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(slotsRemaining / maxSlots) * 264} 264`}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-800">{slotsRemaining}</span>
              <span className="text-slate-400 text-sm">/ {maxSlots}</span>
            </div>
          </div>
          <span className="text-slate-500 text-sm mt-1">Slots remaining</span>
        </div>

        {/* Main Form Card */}
        <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-xl">
          <div className="flex lg:hidden justify-center mb-4">
            <img src={gymIcon} alt="Gym" className="w-16 h-16 object-contain" />
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Gym Booking</h2>
            <p className="text-slate-500 text-sm mt-1">Register for a gym session</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 text-sm">Employee ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your Employee ID"
                        {...field}
                        className="h-11 rounded-lg border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-slate-700 text-sm">Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'h-11 w-full rounded-lg border-slate-200 bg-slate-50 hover:bg-white pl-3 text-left font-normal transition-colors',
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

              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="sessionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700 text-sm">Session</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11 rounded-lg border-slate-200 bg-slate-50 focus:bg-white transition-colors">
                            <SelectValue placeholder={sessionsLoading ? '...' : 'Select'} />
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
                              No sessions
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700">Time</div>
                  <div className="flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-2 text-sm text-slate-500">
                    {selectedSession
                      ? `${selectedSession.time_start.slice(0, 5)}`
                      : '-'}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700">Available</div>
                  <div className="flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-2 text-sm text-slate-500">
                    {selectedSession
                      ? `${slotsRemaining}`
                      : '-'}
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold shadow-md mt-2"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Register
              </Button>
            </form>
          </Form>
        </div>

        {/* Session Info Card */}
        <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-lg">
          <h3 className="text-base font-semibold text-slate-900 mb-3">Session Info</h3>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Session Schedule: {selectedSession ? `${selectedSession.time_start.slice(0, 5)} - ${selectedSession.time_end.slice(0, 5)}` : '08:00 - 20:00'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Max Capacity: {maxSlots} people</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>Location: MTI Gym</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              <span>Late arrival &gt;10 min = auto cancel</span>
            </div>
          </div>
        </div>

        {/* Mobile slots indicator */}
        <div className="lg:hidden flex items-center gap-2 text-slate-500 text-sm">
          <span className="font-semibold text-slate-800">{slotsRemaining}</span>
          <span>/ {maxSlots} Slots remaining</span>
        </div>
      </div>
    </div>
  );
}
