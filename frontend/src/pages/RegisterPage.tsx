import { useState, useEffect, useCallback, useRef } from 'react';
 
import { useForm, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, startOfDay } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import gymIcon from '@/assets/gym-icon.png';
import treadmillImg from '@/assets/treadmill.png';
import benchPressImg from '@/assets/bench-press.png';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useQuery } from '@tanstack/react-query';
import { useGymDbSessions, GymDbSession } from '@/hooks/useGymDbSessions';

const formSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required').max(50, 'Employee ID is too long'),
  employeeType: z.enum(['MTI', 'MMS', 'VISITOR']),
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
  const [successOpen, setSuccessOpen] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    bookingId: number | null;
    date: Date | null;
    sessionName: string;
    timeStart: string;
    timeEnd: string;
    employeeId: string;
    employeeName: string | null;
    department: string | null;
  } | null>(null);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const defaultContactName = 'Gym Coordinator';
  const defaultContactPhone = '+6281275000560';
  const [contactName, setContactName] = useState<string>(defaultContactName);
  const [contactPhone, setContactPhone] = useState<string>(defaultContactPhone);

  useEffect(() => {
    const lsName = typeof window !== 'undefined' ? localStorage.getItem('gym_support_contact_name') : null;
    const lsPhone = typeof window !== 'undefined' ? localStorage.getItem('gym_support_contact_phone') : null;
    if (lsName && lsName.trim().length > 0) setContactName(lsName);
    if (lsPhone && lsPhone.trim().length > 0) setContactPhone(lsPhone);

    (async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        return await resp.json();
      };
      try {
        const json = await tryFetch('/api/app-settings/support-contact');
        if (json?.ok && json.name && json.phone) {
          setContactName(String(json.name));
          setContactPhone(String(json.phone));
          if (typeof window !== 'undefined') {
            localStorage.setItem('gym_support_contact_name', String(json.name));
            localStorage.setItem('gym_support_contact_phone', String(json.phone));
          }
        }
      } catch (_) {
        void 0;
        try {
          const json = await tryFetch('/app-settings/support-contact');
          if (json?.ok && json.name && json.phone) {
            setContactName(String(json.name));
            setContactPhone(String(json.phone));
            if (typeof window !== 'undefined') {
              localStorage.setItem('gym_support_contact_name', String(json.name));
              localStorage.setItem('gym_support_contact_phone', String(json.phone));
            }
          }
        } catch (_) { void 0; }
      }
    })();
  }, []);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [eulaOpen, setEulaOpen] = useState(false);
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const defaultEulaText = 'By proceeding, you agree to use the gym facilities responsibly, follow all safety guidelines, and acknowledge that schedules and quotas are subject to change. You consent to your booking data being processed for attendance and capacity management.';
  const [eulaText, setEulaText] = useState<string>(defaultEulaText);
  const [eulaScrolled, setEulaScrolled] = useState(false);
  const eulaBoxRef = useRef<HTMLDivElement | null>(null);

  const renderEula = (text: string): JSX.Element => {
    const lines = String(text || '').split(/\r?\n/);
    const elements: JSX.Element[] = [];
    let ol: string[] = [];
    let ul: string[] = [];
    const flushLists = () => {
      if (ol.length > 0) {
        const items = ol.slice();
        elements.push(
          <ol key={`ol-${elements.length}`} className="list-decimal pl-5 space-y-1">
            {items.map((t, i) => (
              <li key={`oli-${i}`}>{t}</li>
            ))}
          </ol>
        );
        ol = [];
      }
      if (ul.length > 0) {
        const items = ul.slice();
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc pl-5 space-y-1">
            {items.map((t, i) => (
              <li key={`uli-${i}`}>{t}</li>
            ))}
          </ul>
        );
        ul = [];
      }
    };
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i] ?? '';
      const line = raw.trimEnd();
      if (line.startsWith('## ')) {
        flushLists();
        elements.push(
          <h3 key={`h3-${i}`} className="text-sm font-semibold text-slate-800 mt-3">
            {line.slice(3)}
          </h3>
        );
        continue;
      }
      if (line.startsWith('# ')) {
        flushLists();
        elements.push(
          <h2 key={`h2-${i}`} className="text-base font-bold text-slate-900 mt-1">
            {line.slice(2)}
          </h2>
        );
        continue;
      }
      if (/^-{3,}$/.test(line)) {
        flushLists();
        elements.push(<div key={`hr-${i}`} className="border-t border-border/60 my-2" />);
        continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        ol.push(line.replace(/^\d+\.\s+/, ''));
        continue;
      }
      if (/^(?:-|\*)\s+/.test(line)) {
        ul.push(line.replace(/^(?:-|\*)\s+/, ''));
        continue;
      }
      if (line.trim().length === 0) {
        flushLists();
        continue;
      }
      flushLists();
      elements.push(
        <p key={`p-${i}`} className="text-slate-700">
          {line}
        </p>
      );
    }
    flushLists();
    return <div className="space-y-2">{elements}</div>;
  };
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: '',
      employeeType: 'MTI',
      sessionId: '',
    },
  });

  const selectedDate = form.watch('date');
  const selectedSessionId = form.watch('sessionId');
  const employeeIdInput = form.watch('employeeId');
  const employeeType = form.watch('employeeType');
  const { data: gymDbSessions, isLoading: gymDbSessionsLoading } = useGymDbSessions();

  const controllerSettingsQuery = useQuery({
    queryKey: ['gym-controller-settings'],
    queryFn: async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch controller settings');
        return (await resp.json()) as {
          ok: boolean;
          booking_min_days_ahead?: number;
          booking_max_days_ahead?: number;
          error?: string;
        };
      };
      try {
        const json = await tryFetch('/api/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch controller settings');
        return {
          booking_min_days_ahead: Number(json.booking_min_days_ahead ?? 1) || 1,
          booking_max_days_ahead: Number(json.booking_max_days_ahead ?? 2) || 2,
        };
      } catch (_) {
        const json = await tryFetch('/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch controller settings');
        return {
          booking_min_days_ahead: Number(json.booking_min_days_ahead ?? 1) || 1,
          booking_max_days_ahead: Number(json.booking_max_days_ahead ?? 2) || 2,
        };
      }
    },
    staleTime: 60_000,
  });

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

  const sessionColorClass = (name: string): string => {
    const key = String(name || '').toLowerCase();
    return key.includes('morning')
      ? 'bg-green-100 text-green-900 border-green-200'
      : key.includes('afternoon')
      ? 'bg-blue-100 text-blue-900 border-blue-200'
      : key.includes('night') && (key.includes('1') || key.includes('- 1'))
      ? 'bg-purple-100 text-purple-900 border-purple-200'
      : key.includes('night') && (key.includes('2') || key.includes('- 2'))
      ? 'bg-amber-100 text-amber-900 border-amber-200'
      : 'bg-muted/60 text-foreground border-border/60';
  };

  const sessionFieldTone = (name: string): string => {
    const key = String(name || '').toLowerCase();
    return key.includes('morning')
      ? 'border-green-300 bg-green-50'
      : key.includes('afternoon')
      ? 'border-blue-300 bg-blue-50'
      : key.includes('night') && (key.includes('1') || key.includes('- 1'))
      ? 'border-purple-300 bg-purple-50'
      : key.includes('night') && (key.includes('2') || key.includes('- 2'))
      ? 'border-amber-300 bg-amber-50'
      : 'border-border/60 bg-background';
  };

  const sessionDotColor = (name: string): string => {
    const key = String(name || '').toLowerCase();
    return key.includes('morning')
      ? 'bg-green-500'
      : key.includes('afternoon')
      ? 'bg-blue-500'
      : key.includes('night') && (key.includes('1') || key.includes('- 1'))
      ? 'bg-purple-500'
      : key.includes('night') && (key.includes('2') || key.includes('- 2'))
      ? 'bg-amber-500'
      : 'bg-slate-400';
  };

  const availabilityTone = (remaining: number, quota: number): string => {
    if (remaining <= 0) return 'border-red-300 bg-red-50';
    if (remaining <= Math.ceil(quota * 0.3)) return 'border-yellow-300 bg-yellow-50';
    return 'border-green-300 bg-green-50';
  };

  const availabilityTextColor = (remaining: number, quota: number): string => {
    if (remaining <= 0) return 'text-red-700';
    if (remaining <= Math.ceil(quota * 0.3)) return 'text-yellow-700';
    return 'text-green-700';
  };

  const availabilityDotColor = (remaining: number, quota: number): string => {
    if (remaining <= 0) return 'bg-red-500';
    if (remaining <= Math.ceil(quota * 0.3)) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const fetchEmployeeProfile = useCallback(async (employeeId: string) => {
    const empId = String(employeeId || '').trim();
    if (!empId) return null;
    const tryFetch = async (url: string) => {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to fetch employee details');
      return (await resp.json()) as {
        ok: boolean;
        employees?: Array<{ employee_id: string; name: string; department: string | null }>;
        error?: string;
      };
    };
    const pick = (json: { ok: boolean; employees?: Array<{ employee_id: string; name: string; department: string | null }> }) => {
      if (!json.ok) return null;
      const row = Array.isArray(json.employees) ? json.employees[0] : null;
      if (!row) return null;
      const name = String(row.name || '').trim();
      return { name: name.length > 0 ? name : null, department: row.department ?? null };
    };
    try {
      const json = await tryFetch(`/api/employee-core?ids=${encodeURIComponent(empId)}&limit=1`);
      return pick(json);
    } catch (_) {
      try {
        const json = await tryFetch(`/employee-core?ids=${encodeURIComponent(empId)}&limit=1`);
        return pick(json);
      } catch (_) {
        return null;
      }
    }
  }, []);

  const fetchBookingDetails = useCallback(async (bookingId: number, dateStr: string) => {
    if (!bookingId || !dateStr) return null;
    const params = `from=${encodeURIComponent(dateStr)}&to=${encodeURIComponent(dateStr)}`;
    const tryFetch = async (url: string) => {
      const resp = await fetch(url);
      const json = (await resp.json()) as {
        ok: boolean;
        bookings?: Array<{ booking_id: number; employee_name?: string | null; department?: string | null }>;
        error?: string;
      };
      if (resp.status >= 500) throw new Error(json?.error || 'Server error');
      return json;
    };
    try {
      const json = await tryFetch(`/api/gym-bookings?${params}`);
      if (!json.ok) return null;
      const row = (json.bookings || []).find((b) => Number(b.booking_id) === bookingId) || null;
      if (!row) return null;
      const name = row.employee_name != null ? String(row.employee_name).trim() : '';
      return { name: name.length > 0 ? name : null, department: row.department ?? null };
    } catch (_) {
      try {
        const json = await tryFetch(`/gym-bookings?${params}`);
        if (!json.ok) return null;
        const row = (json.bookings || []).find((b) => Number(b.booking_id) === bookingId) || null;
        if (!row) return null;
        const name = row.employee_name != null ? String(row.employee_name).trim() : '';
        return { name: name.length > 0 ? name : null, department: row.department ?? null };
      } catch (_) {
        return null;
      }
    }
  }, []);

  // Auto-swipe carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

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
        const base = '/api';
        const path = employeeType === 'MTI' ? '/employees' : '/carddb-staff';
        const build = (b: string) => `${b}${path}?q=${encodeURIComponent(q)}${employeeType !== 'MTI' ? `&type=${encodeURIComponent(employeeType)}` : ''}`;
        const tryFetch = async (u: string) => {
          const resp = await fetch(u, { signal: ctrl.signal });
          if (!resp.ok) return null;
          return await resp.json();
        };
        const json = (await tryFetch(build(base))) || (await tryFetch(build('')));
        const success = json && (json.success === true || json.ok === true);
        let list = Array.isArray(json?.employees)
          ? json.employees
          : Array.isArray(json?.rows)
          ? json.rows
          : [];
        if (employeeType !== 'MTI') {
          list = list.filter((v: unknown) => typeof v === 'string' ? !/^\s*MTI/i.test(v) : true);
        }
        setEmpSuggestions(success ? list : []);
        setShowEmpDropdown(success && list.length > 0);
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
  }, [employeeIdInput, employeeType]);

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

  const submitRegistration = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const tryPost = async (url: string) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: data.employeeId,
            employee_type: data.employeeType,
            session_id: data.sessionId,
            booking_date: format(data.date, 'yyyy-MM-dd'),
          }),
        });
        const payload = (await resp.json()) as { ok: boolean; error?: string; booking_id?: number; schedule_id?: number } | null;
        if (resp.status >= 500) throw new Error(payload?.error || 'Server error');
        return payload;
      };
      let payload: { ok: boolean; error?: string; booking_id?: number; schedule_id?: number } | null = null;
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
        setErrorInfo(payload?.error || 'An error occurred. Please try again.');
        setErrorOpen(true);
        return;
      }

      const selectedSession = selectedGymDbSession;
      const employeeProfile = await fetchEmployeeProfile(data.employeeId);

      const bId = payload && typeof payload.booking_id === 'number' ? payload.booking_id : null;
      const dateStr = format(data.date, 'yyyy-MM-dd');
      const bookingDetails = bId ? await fetchBookingDetails(bId, dateStr) : null;
      if (selectedSession) {
        setSuccessInfo({
          bookingId: bId,
          date: data.date,
          sessionName: displaySessionName(selectedSession.session_name),
          timeStart: selectedSession.time_start,
          timeEnd: timeEndForSession(selectedSession),
          employeeId: data.employeeId,
          employeeName: bookingDetails?.name ?? employeeProfile?.name ?? null,
          department: bookingDetails?.department ?? employeeProfile?.department ?? null,
        });
        setSuccessOpen(true);
      }

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
      const msg = error instanceof Error ? error.message : 'An error occurred. Please try again.';
      toast({ title: 'Registration failed', description: msg, variant: 'destructive' });
      setErrorInfo(msg);
      setErrorOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setPendingData(data);
    setEulaAccepted(false);
    setEulaOpen(true);
  };

  useEffect(() => {
    const loadEula = async () => {
      try {
        const tryFetch = async (path: string) => {
          const resp = await fetch(path);
          if (!resp.ok) throw new Error('Failed to fetch ' + path);
          const txt = await resp.text();
          return txt;
        };
        const baseUrl = import.meta.env.BASE_URL || '/';
        const withBase = (file: string) => (baseUrl.endsWith('/') ? `${baseUrl}${file}` : `${baseUrl}/${file}`);
        const candidates = [
          withBase('eula.md'),
          '/eula.md',
          `${window.location.origin}${withBase('eula.md')}`,
          withBase('eula.txt'),
          '/eula.txt',
          `${window.location.origin}${withBase('eula.txt')}`,
        ];
        let txt: string | null = null;
        for (const path of candidates) {
          try {
            const next = await tryFetch(path);
            if (next && next.trim().length > 0) {
              txt = next;
              break;
            }
          } catch (_) {
            void 0;
          }
        }
        setEulaText(txt ?? defaultEulaText);
      } catch (_) {
        setEulaText(defaultEulaText);
      }
    };
    if (eulaOpen) {
      void loadEula();
    }
  }, [eulaOpen]);

  useEffect(() => {
    const el = eulaBoxRef.current;
    if (!el) return;
    const canScroll = el.scrollHeight > el.clientHeight + 1;
    setEulaScrolled(!canScroll);
  }, [eulaText, eulaOpen]);

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
    <div className="min-h-screen flex bg-gradient-to-br from-background via-muted/40 to-muted/60">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 p-8">
        <div className="w-full bg-card/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-between p-12 relative overflow-hidden border border-border/60 shadow-lg ring-1 ring-black/5 dark:ring-white/10">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-72 h-72 border border-border/60 rounded-full absolute" />
            <div className="w-96 h-96 border border-border/60 rounded-full absolute" />
            <div className="w-[28rem] h-[28rem] border border-border/50 rounded-full absolute" />
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
            <h1 className="text-3xl font-bold text-foreground mb-3 tracking-tight">
              Book your gym session
              <br />
              quick and easy.
            </h1>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
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
        <div className="w-full max-w-xl bg-card rounded-3xl p-10 lg:p-14 shadow-xl border border-border/60">
          <div className="flex lg:hidden justify-center mb-6">
            <img src={gymIcon} alt="Gym" className="w-20 h-20 object-contain" />
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">Super Gym</div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Gym Booking</h2>
            <p className="text-muted-foreground text-sm mt-1">Register for a gym session</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-5">
              <FormField
                control={form.control}
                name="employeeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-800">Employee Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl focus:ring-0 focus:ring-offset-0">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="z-[9999] bg-white">
                        <SelectItem value="MTI">MTI</SelectItem>
                        <SelectItem value="MMS">MMS / MBM</SelectItem>
                        <SelectItem value="VISITOR">Visitor</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-slate-500 mt-1">Non‑MTI bookings require admin approval.</div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-800">Employee ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your Employee ID"
                        {...field}
                        onFocus={() => setShowEmpDropdown(true)}
                        onBlur={() => setTimeout(() => setShowEmpDropdown(false), 150)}
                        className="h-12 rounded-xl border-border/60 bg-background focus:bg-background transition-colors"
                      />
                    </FormControl>
                    {showEmpDropdown && (empLoading || empSuggestions.length > 0) && (
                      <div className="mt-2 border border-border/60 rounded-xl bg-card shadow-sm max-h-48 overflow-auto">
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
                    <FormLabel className="text-slate-800">Date</FormLabel>
                    <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'h-12 w-full rounded-xl border-border/60 bg-background hover:bg-muted/40 pl-3 text-left font-normal transition-colors',
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
                          onSelect={(d) => {
                            field.onChange(d);
                            if (d) setDatePopoverOpen(false);
                          }}
                          disabled={(date) => {
                            const minDays = Number(controllerSettingsQuery.data?.booking_min_days_ahead ?? 1) || 1;
                            const maxDays = Number(controllerSettingsQuery.data?.booking_max_days_ahead ?? 2) || 2;
                            const start = startOfDay(addDays(new Date(), minDays));
                            const end = startOfDay(addDays(new Date(), maxDays));
                            const dateToCheck = startOfDay(date);
                            return dateToCheck < start || dateToCheck > end;
                          }}
                          modifiers={{
                            highlighted: (() => {
                              const minDays = Number(controllerSettingsQuery.data?.booking_min_days_ahead ?? 1) || 1;
                              const maxDays = Number(controllerSettingsQuery.data?.booking_max_days_ahead ?? 2) || 2;
                              const days: Date[] = [];
                              for (let d = minDays; d <= maxDays; d++) {
                                days.push(startOfDay(addDays(new Date(), d)));
                              }
                              return days;
                            })(),
                            todayGreen: [startOfDay(new Date())],
                          }}
                          modifiersClassNames={{
                            highlighted:
                              "bg-blue-100 text-blue-900 font-semibold rounded-md ring-1 ring-blue-300",
                            todayGreen:
                              "bg-green-100 text-green-900 font-semibold rounded-md ring-1 ring-green-300 opacity-100",
                          }}
                          classNames={{
                            day_today:
                              "bg-green-100 text-green-900 font-semibold rounded-md ring-1 ring-green-300 opacity-100",
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                        <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/60 flex items-center gap-4">
                          <span className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-sm bg-blue-100 ring-1 ring-blue-300" />
                            <span>Available dates</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-sm bg-green-100 ring-1 ring-green-300" />
                            <span>Today</span>
                          </span>
                        </div>
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
                      <FormLabel className="text-slate-800">Session</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger
                            disabled={!selectedDate}
                            className={`h-12 rounded-xl focus:ring-0 focus:ring-offset-0 transition-colors ${selectedGymDbSession ? sessionFieldTone(selectedGymDbSession.session_name) : 'border-border/60 bg-background'}`}
                          >
                            {selectedGymDbSession && (
                              <span className={`inline-block h-2 w-2 rounded-full ${sessionDotColor(selectedGymDbSession.session_name)} mr-2`} />
                            )}
                            <SelectValue
                              placeholder={
                                !selectedDate
                                  ? 'Pick date first'
                                  : gymDbSessionsLoading
                                    ? 'Loading...'
                                    : 'Select'
                              }
                            />
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
                        {!selectedDate && (
                          <div className="text-xs text-slate-500 mt-1">Pick a date first</div>
                        )}
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-800 mt-2 md:mt-0">Time</div>
                  <div className={`flex h-12 w-full items-center rounded-xl px-3 py-2 text-sm ${selectedGymDbSession ? sessionFieldTone(selectedGymDbSession.session_name) : 'border border-border/60 bg-background text-muted-foreground'}`}>
                    {selectedGymDbSession ? (
                      <>
                        <span className={`inline-block h-2 w-2 rounded-full ${sessionDotColor(selectedGymDbSession.session_name)} mr-2`} />
                        <span className="font-medium text-slate-800">
                          {selectedGymDbSession.time_start} - {timeEndForSession(selectedGymDbSession)}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-800 mt-2 md:mt-0">Available</div>
                  <div className={`flex h-12 w-full items-center rounded-xl px-3 py-2 text-sm ${selectedGymDbSession ? sessionFieldTone(selectedGymDbSession.session_name) : 'border border-border/60 bg-background'}`}>
                    {selectedGymDbSession ? (
                      availabilityLoading ? (
                        <span className="text-slate-600">Loading...</span>
                      ) : (
                        (() => {
                          const a = availability[selectedGymDbSession.time_start];
                          const booked = a ? a.booked : 0;
                          const quota = a ? a.quota : selectedGymDbSession.quota;
                          const remaining = Math.max(0, quota - booked);
                          const color = availabilityTextColor(remaining, quota);
                          const dot = availabilityDotColor(remaining, quota);
                          return (
                            <>
                              <span className={`inline-block h-2 w-2 rounded-full ${dot} mr-2`} />
                              <span className={`${color} font-medium`}>{booked}/{quota}</span>
                            </>
                          );
                        })()
                      )
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600">
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
                className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold shadow-lg"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Register
              </Button>
            </form>
          </Form>
          <Dialog open={eulaOpen} onOpenChange={(open) => { setEulaOpen(open); if (!open) { setPendingData(null); setEulaAccepted(false); } }}>
            <DialogContent className="max-w-3xl sm:max-w-3xl p-8">
              <DialogHeader>
                <DialogTitle>End User License Agreement</DialogTitle>
                <DialogDescription>
                  Please review and accept the agreement before proceeding with your registration.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm text-slate-700">
                <div
                  ref={eulaBoxRef}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
                    if (atBottom) setEulaScrolled(true);
                  }}
                  className="max-h-[60vh] overflow-auto rounded-md border border-border/60 p-4 bg-muted/30"
                >
                  {renderEula(eulaText)}
                </div>
                <label className="flex items-center gap-3 text-slate-800">
                  <Checkbox disabled={!eulaScrolled} checked={eulaAccepted} onCheckedChange={(v) => setEulaAccepted(Boolean(v))} />
                  <span>I accept the EULA terms</span>
                </label>
                {!eulaScrolled && (
                  <div className="text-xs text-slate-500">Scroll to the bottom to enable acceptance</div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEulaOpen(false); setPendingData(null); setEulaAccepted(false); }}>
                  Cancel
                </Button>
                <Button disabled={!eulaScrolled || !eulaAccepted || !pendingData || isSubmitting} onClick={async () => { if (!pendingData) return; await submitRegistration(pendingData); setEulaOpen(false); setPendingData(null); setEulaAccepted(false); }} className="bg-amber-400 hover:bg-amber-500 text-slate-900">
                  I Accept and Register
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registration Successful</DialogTitle>
                <DialogDescription>
                  {successInfo
                    ? `${successInfo.sessionName} on ${successInfo.date ? format(successInfo.date, 'MMMM d, yyyy') : ''} (${successInfo.timeStart} - ${successInfo.timeEnd})`
                    : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="text-sm text-slate-700">
                {successInfo?.bookingId != null ? (
                  <div className="mt-2">Booking ID: {`GYMBOOK${String(successInfo.bookingId).padStart(2, '0')}`}</div>
                ) : null}
                {successInfo ? (
                  <div className="mt-2 space-y-1">
                    <div>Name: {successInfo.employeeName || '-'}</div>
                    <div>Department: {successInfo.department || '-'}</div>
                    <div>Employee ID: {successInfo.employeeId}</div>
                  </div>
                ) : null}
                <div className="mt-3 text-slate-600">
                  Need help or want to change your booking? Contact {contactName} at {contactPhone}.
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    const name = successInfo?.sessionName || 'Gym Session';
                    const when = successInfo?.date ? format(successInfo.date, 'yyyy-MM-dd') : '';
                    const msg = encodeURIComponent(`Hello ${contactName}, I need assistance with my booking for ${name} on ${when}.`);
                    const phoneDigits = contactPhone.replace(/[^0-9]/g, '');
                    window.open(`https://wa.me/${phoneDigits}?text=${msg}`, '_blank');
                  }}
                >
                  Contact via WhatsApp
                </Button>
                <Button onClick={() => setSuccessOpen(false)} className="bg-amber-400 hover:bg-amber-500 text-slate-900">
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registration Failed</DialogTitle>
                <DialogDescription>{errorInfo || ''}</DialogDescription>
              </DialogHeader>
              <div className="text-sm text-slate-700">
                <div className="mt-3 text-slate-600">
                  Need assistance? Contact {contactName} at {contactPhone}.
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    const msg = encodeURIComponent('Hello ' + contactName + ', I need assistance with my gym registration.');
                    const phoneDigits = contactPhone.replace(/[^0-9]/g, '');
                    window.open(`https://wa.me/${phoneDigits}?text=${msg}`, '_blank');
                  }}
                >
                  Contact via WhatsApp
                </Button>
                <Button onClick={() => setErrorOpen(false)} className="bg-amber-400 hover:bg-amber-500 text-slate-900">
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
