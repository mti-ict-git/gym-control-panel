import { useState, useEffect, useCallback } from 'react';
 
import { useForm, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, startOfDay } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import gymIcon from '@/assets/gym-icon.png';
import treadmillImg from '@/assets/treadmill.png';
import benchPressImg from '@/assets/bench-press.png';
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
import { useGymDbSessions, GymDbSession } from '@/hooks/useGymDbSessions';

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
  const [empSuggestions, setEmpSuggestions] = useState<string[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);
  const [availability, setAvailability] = useState<Record<string, { available: number; booked: number; quota: number }>>({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: '',
      sessionId: '',
    },
  });

  const selectedDate = form.watch('date');
  const selectedSessionId = form.watch('sessionId');
  const employeeIdInput = form.watch('employeeId');
  const { data: gymDbSessions, isLoading: gymDbSessionsLoading } = useGymDbSessions();

  const sessionKey = (s: GymDbSession): string => `${s.session_name}__${s.time_start}`;
  const selectedGymDbSession = (gymDbSessions || []).find((s) => sessionKey(s) === selectedSessionId) ?? null;

  const displaySessionName = (raw: string): string => {
    const cleaned = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) return '';
    return cleaned
      .split(' ')
      .map((w) => {
        if (!/[A-Za-z]/.test(w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');
  };

  const endFor = (label: string): string | null => {
    switch (label) {
      case 'Morning':
        return '06:30';
      case 'Night 1':
        return '20:00';
      case 'Night 2':
        return '22:00';
      default:
        return null;
    }
  };

  const timeEndForSession = (session: GymDbSession): string =>
    session.time_end ?? endFor(session.session_name) ?? session.time_start;

  // Auto-swipe carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Employee ID suggestions from Master Employee DB via local tester service
  useEffect(() => {

    const q = (employeeIdInput || '').trim();
    if (q.length === 0) {
      setEmpSuggestions([]);
      return;
    }

    setEmpLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const url = `/api/employees?q=${encodeURIComponent(q)}`;
        const resp = await fetch(url, { signal: ctrl.signal });
        if (resp.ok) {
          const json = await resp.json();
          if (json?.success) {
            setEmpSuggestions(Array.isArray(json.employees) ? json.employees : []);
            setShowEmpDropdown(true);
          } else {
            setEmpSuggestions([]);
          }
        } else {
          setEmpSuggestions([]);
        }
      } catch (_) {
        setEmpSuggestions([]);
      } finally {
        setEmpLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [employeeIdInput]);

  const fetchAvailability = useCallback(async (dateStr: string) => {
    if (!dateStr) {
      setAvailability({});
      return;
    }
    setAvailabilityLoading(true);
    try {
      const params = `date=${encodeURIComponent(dateStr)}`;
      const tryFetch = async (url: string) => {
        const resp = await fetch(`${url}?${params}`);
        const json = (await resp.json()) as { success: boolean; error?: string; sessions?: { time_start: string; available: number; booked_count: number; quota: number }[] } | null;
        if (resp.status >= 500) throw new Error(json?.error || 'Server error');
        return json;
      };
      let json: { success: boolean; error?: string; sessions?: { time_start: string; available: number; booked_count: number; quota: number }[] } | null = null;
      try {
        json = await tryFetch(`/api/gym-availability`);
      } catch (_) {
        json = await tryFetch(`/gym-availability`);
      }
      if (!json || !json.success) {
        setAvailability({});
        return;
      }
      const map: Record<string, { available: number; booked: number; quota: number }> = {};
      (json.sessions || []).forEach((s) => {
        map[String(s.time_start)] = {
          available: Number(s.available),
          booked: Number(s.booked_count || 0),
          quota: Number(s.quota || 0),
        };
      });
      setAvailability(map);
    } catch (_) {
      setAvailability({});
    } finally {
      setAvailabilityLoading(false);
    }
  }, []);

  useEffect(() => {
    const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
    if (!dateStr) {
      setAvailability({});
      return;
    }
    const t = setTimeout(() => { void fetchAvailability(dateStr); }, 200);
    return () => { clearTimeout(t); };
  }, [selectedDate, fetchAvailability]);

  useEffect(() => {
    const endpoint = import.meta.env.VITE_DB_TEST_ENDPOINT as string | undefined;
    const base = endpoint && endpoint.trim().length > 0 ? endpoint : '/api';
    const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
    const timeStart = selectedGymDbSession?.time_start || '';
    if (!dateStr || !timeStart) return;
    if (availability[timeStart]) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const resp = await fetch(`${base}/gym-bookings?from=${encodeURIComponent(dateStr)}&to=${encodeURIComponent(dateStr)}`, { signal: ctrl.signal });
        const json = (await resp.json()) as { ok: boolean; bookings?: Array<{ time_start?: string | null; status?: string | null }> } | null;
        if (!json || !json.ok) return;
        const rows = Array.isArray(json.bookings) ? json.bookings : [];
        const booked = rows.filter((r) => String(r.time_start || '') === timeStart && ['BOOKED','CHECKIN'].includes(String(r.status || '').toUpperCase())).length;
        setAvailability((prev) => {
          const quota = selectedGymDbSession?.quota ?? 15;
          return { ...prev, [timeStart]: { booked, quota, available: Math.max(0, quota - booked) } };
        });
      } catch (_) {
        setAvailability((prev) => ({ ...prev }));
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [selectedDate, selectedGymDbSession, availability]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const tryPost = async (url: string) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: data.employeeId,
            session_id: data.sessionId,
            booking_date: format(data.date, 'yyyy-MM-dd'),
          }),
        });
        const payload = (await resp.json()) as { ok: boolean; error?: string } | null;
        if (resp.status >= 500) throw new Error(payload?.error || 'Server error');
        return payload;
      };
      let payload: { ok: boolean; error?: string } | null = null;
      try {
        payload = await tryPost(`/api/gym-booking-create`);
      } catch (_) {
        payload = await tryPost(`/gym-booking-create`);
      }
      if (!payload || !payload.ok) {
        toast({
          title: 'Registration failed',
          description: payload?.error || 'An error occurred. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      const selectedSession = selectedGymDbSession;

      toast({
        title: 'Registration successful!',
        description: `You have been registered for ${selectedSession ? displaySessionName(selectedSession.session_name) : 'the selected session'} on ${format(data.date, 'MMMM d, yyyy')}.`,
      });

      if (selectedDate && selectedGymDbSession) {
        const key = selectedGymDbSession.time_start;
        setAvailability((prev) => {
          const existing = prev[key];
          if (existing) {
            const booked = Math.max(0, existing.booked + 1);
            const available = Math.max(0, existing.quota - booked);
            return { ...prev, [key]: { ...existing, booked, available } };
          }
          const quota = selectedGymDbSession.quota;
          return { ...prev, [key]: { booked: 1, quota, available: Math.max(0, quota - 1) } };
        });
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        void fetchAvailability(dateStr);
      }
      form.setValue('employeeId', '');
    } catch (error: unknown) {
      console.error('Registration error:', error);
      toast({
        title: 'Registration failed',
        description: error instanceof Error ? error.message : 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = (errors: FieldErrors<FormData>) => {
    console.log('Validation errors:', errors);
    const errorMessages = Object.values(errors)
      .map((e) => e?.message)
      .filter(Boolean);

    if (errorMessages.length > 0) {
      toast({
        title: 'Validation Error',
        description: errorMessages.join(', ') || 'Please check the form for errors.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-400/80">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 p-6">
        <div className="w-full bg-slate-100 rounded-3xl flex flex-col items-center justify-between p-12 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-72 h-72 border border-slate-300 rounded-full absolute" />
            <div className="w-96 h-96 border border-slate-300 rounded-full absolute" />
            <div className="w-[28rem] h-[28rem] border border-slate-200 rounded-full absolute" />
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Carousel - Centered on circles */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <div className="w-72 h-72 flex items-center justify-center relative">
                {carouselImages.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Fitness ${idx + 1}`}
                    className={`absolute w-64 h-64 object-contain transition-all duration-500 ${
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

          <div className="relative z-10 text-center">
            <h1 className="text-2xl font-semibold text-slate-800 mb-3">
              Book your gym session
              <br />
              quick and easy.
            </h1>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              Reserve your spot for tomorrow or the next day. Stay fit, stay healthy!
            </p>

            <div className="flex justify-center gap-2 mt-8">
              {carouselImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    idx === currentSlide
                      ? 'bg-slate-800'
                      : 'bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 p-6 flex items-center justify-center">
        <div className="w-full max-w-lg bg-white rounded-3xl p-10 lg:p-14 shadow-xl">
          <div className="flex lg:hidden justify-center mb-6">
            <img src={gymIcon} alt="Gym" className="w-20 h-20 object-contain" />
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-slate-900">Gym Booking</h2>
            <p className="text-slate-500 text-sm mt-1">Register for a gym session</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-5">
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
                        onFocus={() => setShowEmpDropdown(true)}
                        onBlur={() => setTimeout(() => setShowEmpDropdown(false), 150)}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                      />
                    </FormControl>
                    {showEmpDropdown && (empLoading || empSuggestions.length > 0) && (
                      <div className="mt-2 border border-slate-200 rounded-xl bg-white shadow-sm max-h-48 overflow-auto">
                        {empLoading ? (
                          <div className="px-3 py-2 text-sm text-slate-500">Searching...</div>
                        ) : (
                          empSuggestions.map((id) => (
                            <button
                              type="button"
                              key={id}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                field.onChange(id);
                                setShowEmpDropdown(false);
                              }}
                            >
                              {id}
                            </button>
                          ))
                        )}
                        {!empLoading && empSuggestions.length === 0 && (
                          <div className="px-3 py-2 text-sm text-slate-500">No matches</div>
                        )}
                      </div>
                    )}
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="sessionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Session</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors">
                            <SelectValue placeholder={gymDbSessionsLoading ? 'Loading...' : 'Select'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="z-[9999] bg-white">
                          {gymDbSessionsLoading ? (
                            <SelectItem value="__loading__" disabled>
                              Loading...
                            </SelectItem>
                          ) : (gymDbSessions?.length ?? 0) > 0 ? (
                            (gymDbSessions || [])
                              .slice()
                              .sort((a, b) => a.time_start.localeCompare(b.time_start))
                              .map((s) => (
                                <SelectItem key={sessionKey(s)} value={sessionKey(s)}>
                                  {displaySessionName(s.session_name)}
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

                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700 mt-2 md:mt-0">Time</div>
                  <div className="flex h-12 w-full items-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500">
                    {selectedGymDbSession
                      ? `${selectedGymDbSession.time_start} - ${timeEndForSession(selectedGymDbSession)}`
                      : '-'}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700 mt-2 md:mt-0">Available</div>
                  <div className="flex h-12 w-full items-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500">
                    {selectedGymDbSession
                      ? availabilityLoading
                        ? 'Loading...'
                        : (() => {
                            const a = availability[selectedGymDbSession.time_start];
                            const booked = a ? a.booked : 0;
                            const quota = a ? a.quota : selectedGymDbSession.quota;
                            return `${booked}/${quota}`;
                          })()
                      : '-'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {selectedGymDbSession
                      ? (() => {
                          const a = availability[selectedGymDbSession.time_start];
                          const booked = a ? a.booked : 0;
                          const quota = a ? a.quota : selectedGymDbSession.quota;
                          const remaining = Math.max(0, quota - booked);
                          return `Remaining: ${remaining}`;
                        })()
                      : ''}
                  </div>
                </div>
              </div>

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
