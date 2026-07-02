import { useEffect, useRef, useState } from 'react';
import type { ElementType } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, addDays } from 'date-fns';
import { FileText, Download, Calendar, Users, Clock, Filter, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DatePickerCalendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

type DateRange = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom' | 'all';

const API_BASES = ['/api', ''] as const;

interface BookingRecord {
  booking_id: number;
  employee_id: string;
  card_no: string | null;
  employee_name?: string | null;
  name?: string | null;
  department: string | null;
  gender: string | null;
  session_name: string;
  booking_date: string;
  time_start: string | null;
  time_end: string | null;
  time_in: string | null;
  time_out: string | null;
  status?: string | null;
}

interface LiveTapRange {
  employee_id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
}

interface ReportQueryResult {
  rows: BookingRecord[];
  total: number;
  time_in_total?: number;
  time_out_total?: number;
  male_total?: number;
  female_total?: number;
  departments?: string[];
  sessions?: string[];
}

function formatBookingId(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-';
  return `GYMBOOK${String(n)}`;
}

// Parse a 'yyyy-MM-dd' string as a LOCAL calendar date. `new Date('2026-06-26')`
// parses as UTC midnight, which shifts the day in non-UTC timezones; this keeps
// the date the user picked intact for startOfDay/endOfDay.
function parseLocalDate(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// A themed date picker (Popover + Calendar) replacing the native <input type="date">,
// which renders an OS-styled control that ignores the app theme/dark mode. Value is
// the same 'yyyy-MM-dd' string the rest of the page uses; `disabled` constrains the
// selectable range (e.g. end date can't precede the start date).
function DatePickerField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: { before?: Date; after?: Date };
}) {
  const [open, setOpen] = useState(false);
  const selected = parseLocalDate(value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('w-full justify-start text-left font-normal', !selected && 'text-muted-foreground')}
          >
            <Calendar className="mr-2 h-4 w-4 opacity-60" />
            {selected ? format(selected, 'MMM d, yyyy') : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <DatePickerCalendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={disabled}
            onSelect={(d) => {
              if (d) {
                onChange(format(d, 'yyyy-MM-dd'));
                setOpen(false);
              }
            }}
            initialFocus
            className="pointer-events-auto"
            classNames={{
              // Make "today" stand out: a bold amber ring + text, distinct from a
              // plain day and from the selected day (which stays filled primary).
              // The ring layers over the selected fill, so today+selected reads as
              // a filled cell with an amber outline.
              day_today: 'font-semibold text-amber-600 ring-2 ring-inset ring-amber-500 rounded-md',
            }}
          />
          {selected && (
            <div className="flex justify-end border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Escape a value for CSV: quote when it contains a comma/quote/newline (doubling
// internal quotes) and neutralise spreadsheet formula injection (=, +, -, @).
// A lone "-" placeholder or a plain (negative) number is NOT a formula, so it is
// left untouched — otherwise every empty "-" cell would export as "'-".
function csvEscape(value: unknown): string {
  let s = value == null ? '' : String(value);
  const isPlainNumberOrDash = s === '-' || /^-?\d+([.,]\d+)?$/.test(s);
  if (!isPlainNumberOrDash && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDateOnly(value: string | null | undefined): string {
  const s = String(value || '').slice(0, 10);
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return format(d, 'yyyy-MM-dd');
}

function getDateRange(range: DateRange, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const now = new Date();
  
    switch (range) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'all':
        return { start: new Date('1970-01-01'), end: new Date('2100-01-01') };
    case 'yesterday': {
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'custom':
      return { 
        start: customStart ? startOfDay(customStart) : startOfDay(now), 
        end: customEnd ? endOfDay(customEnd) : endOfDay(now) 
      };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

function formatDuration(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return '-';
  
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
    case 'CHECKED_OUT':
      return <Badge variant="outline" className="text-green-600 border-green-600">Completed</Badge>;
    case 'IN_GYM':
      return <Badge variant="outline" className="text-blue-600 border-blue-600">In Gym</Badge>;
    case 'BOOKED':
      return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Booked</Badge>;
    case 'NO_SHOW':
      return <Badge variant="outline" className="text-red-600 border-red-600">No Show</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getSessionChip(session: string | null) {
  const s = String(session || '').trim().toLowerCase();
  if (s === 'morning') {
    return (
      <span className="inline-flex items-center rounded-md bg-green-100 text-green-700 border border-green-200 px-2 py-1 text-xs font-medium">
        Morning
      </span>
    );
  }
  if (s === 'afternoon') {
    return (
      <span className="inline-flex items-center rounded-md bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 text-xs font-medium">
        Afternoon
      </span>
    );
  }
  if (s === 'evening' || s.startsWith('evening')) {
    return (
      <span className="inline-flex items-center rounded-md bg-purple-100 text-purple-700 border border-purple-200 px-2 py-1 text-xs font-medium">
        {session}
      </span>
    );
  }
  if (s === 'night - 1' || s === 'night-1' || s === 'night1') {
    return (
      <span className="inline-flex items-center rounded-md bg-purple-100 text-purple-700 border border-purple-200 px-2 py-1 text-xs font-medium">
        Night - 1
      </span>
    );
  }
  if (s === 'night - 2' || s === 'night-2' || s === 'night2' || s.includes('night') && s.includes('ramadhan')) {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 text-xs font-medium">
        {session}
      </span>
    );
  }
  if (!s) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 text-xs font-medium">
      {session}
    </span>
  );
}

function getScheduleChip(session: string | null, text: string) {
  const label = String(session || '').trim().toLowerCase();
  const fallback = label.startsWith('morning')
    ? '05:00 - 12:00'
    : label.startsWith('afternoon')
    ? '12:00 - 18:00'
    : label.includes('evening')
    ? '17:00 - 19:00'
    : label.includes('night') && label.includes('1')
    ? '18:00 - 21:00'
    : label.includes('night') && (label.includes('2') || label.includes('ramadhan'))
    ? '21:00 - 23:59'
    : '-';
  const content = String(text || '').trim() || fallback;
  const color = label.startsWith('morning')
    ? 'bg-green-100 text-green-700 border border-green-200'
    : label.startsWith('afternoon')
    ? 'bg-blue-100 text-blue-700 border border-blue-200'
    : label.includes('evening')
    ? 'bg-purple-100 text-purple-700 border border-purple-200'
    : label.includes('night') && label.includes('1')
    ? 'bg-purple-100 text-purple-700 border border-purple-200'
    : label.includes('night') && (label.includes('2') || label.includes('ramadhan'))
    ? 'bg-amber-100 text-amber-700 border border-amber-200'
    : 'bg-slate-100 text-slate-700 border border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${color}`}>
      {content}
    </span>
  );
}

function getGenderLabel(gender: string | null) {
  const v = String(gender || '').trim().toUpperCase();
  if (v === 'M' || v === 'MALE') return 'Male';
  if (v === 'F' || v === 'FEMALE') return 'Female';
  return '-';
}

function getGenderChip(gender: string | null) {
  const label = getGenderLabel(gender);
  if (label === 'Male') {
    return (
      <span className="inline-flex items-center rounded-md bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 text-xs font-medium">
        Male
      </span>
    );
  }
  if (label === 'Female') {
    return (
      <span className="inline-flex items-center rounded-md bg-pink-100 text-pink-700 border border-pink-200 px-2 py-1 text-xs font-medium">
        Female
      </span>
    );
  }
  return <span className="text-muted-foreground">-</span>;
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filterEmpId, setFilterEmpId] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterGender, setFilterGender] = useState<'all' | 'Male' | 'Female'>('all');
  const [filterSession, setFilterSession] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [sortBy, setSortBy] = useState<null | 'department' | 'employee_id' | 'name' | 'gender' | 'session' | 'booking_id'>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // In-flight guards for the auto-fired DB write jobs (backfill POST / live-sync
  // GET). Each effect fires on every [dateRange, fromKey, toKey] change and on
  // mount; without a guard, overlapping requests for the same range can pile up.
  // Each ref holds the range key currently being processed (null = idle), so a
  // re-fire for the same key while one is still in flight is skipped.
  const backfillInFlightKeyRef = useRef<string | null>(null);
  const liveSyncInFlightKeyRef = useRef<string | null>(null);

  const { start, end } = getDateRange(
    dateRange,
    parseLocalDate(customStartDate),
    parseLocalDate(customEndDate)
  );
  // Stable string keys for effect deps — `start`/`end` are fresh Date objects on
  // every render, so depending on them directly re-fires effects each render.
  const fromKey = format(start, 'yyyy-MM-dd');
  const toKey = format(end, 'yyyy-MM-dd');

  const fetchReportsPage = async (base: string, pageParam: number, limitParam: number) => {
    const fromStr = format(start, 'yyyy-MM-dd');
    const toStr = format(end, 'yyyy-MM-dd');
    const empQ = String(filterEmpId || '').trim();
    const deptQ = filterDept !== 'all' ? filterDept : '';
    const genderQ = filterGender === 'Male' ? 'M' : (filterGender === 'Female' ? 'F' : '');
    const sessionQ = filterSession !== 'all' ? filterSession : '';
    const resp = await fetch(`${base}/gym-reports?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&page=${encodeURIComponent(String(pageParam))}&limit=${encodeURIComponent(String(limitParam))}&sort_by=${encodeURIComponent(String(sortBy || ''))}&sort_dir=${encodeURIComponent(String(sortDir))}&employee_id=${encodeURIComponent(empQ)}&department=${encodeURIComponent(deptQ)}&gender=${encodeURIComponent(genderQ)}&session=${encodeURIComponent(sessionQ)}`);
    // Throw (don't return empty) on failure so an actual error is distinguishable
    // from a genuinely empty result and the base fallback / error UI can kick in.
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (!json || !json.ok) throw new Error(String(json?.error || 'Request failed'));
    const rows = Array.isArray(json.reports) ? json.reports : [];
    const mapped = rows.map((r: unknown) => {
      const obj = r as {
        BookingID?: number;
        booking_id?: number;
        EmployeeID?: string;
        employee_id?: string;
        CardNo?: string | null;
        Name?: string | null;
        Department?: string | null;
        Gender?: string | null;
        SessionName?: string | null;
        BookingDate?: string | Date | null;
        ReportDate?: string | Date | null;
        TimeStart?: string | null;
        TimeEnd?: string | null;
        TimeIn?: string | Date | null;
        TimeOut?: string | Date | null;
      };
      return {
        booking_id: Number(obj.BookingID ?? obj.booking_id ?? 0),
        employee_id: String(obj.EmployeeID ?? obj.employee_id ?? ''),
        card_no: obj.CardNo != null ? String(obj.CardNo) : null,
        employee_name: obj.Name != null ? String(obj.Name) : null,
        name: obj.Name != null ? String(obj.Name) : null,
        department: obj.Department != null ? String(obj.Department) : null,
        gender: obj.Gender != null ? String(obj.Gender) : null,
        session_name: obj.SessionName != null ? String(obj.SessionName) : '',
        booking_date:
          obj.BookingDate
            ? String(obj.BookingDate).slice(0, 10)
            : obj.ReportDate
            ? String(obj.ReportDate).slice(0, 10)
            : '',
        time_start: obj.TimeStart != null ? String(obj.TimeStart) : null,
        time_end: obj.TimeEnd != null ? String(obj.TimeEnd) : null,
        time_in: obj.TimeIn != null ? String(obj.TimeIn) : null,
        time_out: obj.TimeOut != null ? String(obj.TimeOut) : null,
        status: null,
      } as BookingRecord;
    }) as BookingRecord[];
    return {
      rows: mapped,
      total: Number(json.total || 0),
      time_in_total: Number(json.time_in_total || 0),
      time_out_total: Number(json.time_out_total || 0),
      male_total: Number(json.male_total || 0),
      female_total: Number(json.female_total || 0),
      departments: Array.isArray(json.departments) ? json.departments.map((d: unknown) => String(d)) : [],
      sessions: Array.isArray(json.sessions) ? json.sessions.map((s: unknown) => String(s)) : [],
    } as ReportQueryResult;
  };

  const loadReportsPage = async (pageParam: number, limitParam: number) => {
    // Prefer the '/api' base; on failure fall back to the bare path. If BOTH
    // throw, let it propagate so react-query surfaces the error (vs. silent empty).
    try {
      return await fetchReportsPage('/api', pageParam, limitParam);
    } catch (_) {
      return await fetchReportsPage('', pageParam, limitParam);
    }
  };

  const { data: bookingDataRes = { rows: [], total: 0 } as ReportQueryResult, isLoading: bookingsLoading, isError: bookingsError, error: bookingsErrorObj } = useQuery<ReportQueryResult>({
    queryKey: ['gym-reports', dateRange, customStartDate, customEndDate, page, pageSize, sortBy, sortDir, filterEmpId, filterDept, filterGender, filterSession],
    queryFn: async () => loadReportsPage(page, pageSize),
    staleTime: 60000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  

  

  const bookingData = bookingDataRes.rows;
  const totalCount = bookingDataRes.total;

  // Reset to page 1 whenever anything that changes the result set changes —
  // including the employee/department/gender/session filters, so a filter that
  // shrinks the result set can't strand the user on a now-empty page.
  useEffect(() => {
    setPage(1);
  }, [dateRange, customStartDate, customEndDate, sortBy, sortDir, filterEmpId, filterDept, filterGender, filterSession]);

  useEffect(() => {
    if (dateRange === 'all') return;
    const rangeDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (!Number.isFinite(rangeDays) || rangeDays > 45) return;
    // Skip if a backfill for this exact range is already in flight, so overlapping
    // heavyweight DB write jobs for the same range can't pile up.
    const rangeKey = `${fromKey}__${toKey}`;
    if (backfillInFlightKeyRef.current === rangeKey) return;
    backfillInFlightKeyRef.current = rangeKey;
    const path = `/gym-reports-backfill?from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(toKey)}`;
    fetch(`${API_BASES[0]}${path}`, { method: 'POST' })
      .catch(() => fetch(`${API_BASES[1]}${path}`, { method: 'POST' }))
      .catch(() => {})
      .finally(() => {
        // Clear only if no newer range has claimed the ref in the meantime.
        if (backfillInFlightKeyRef.current === rangeKey) backfillInFlightKeyRef.current = null;
      });
    // Depend on the stable yyyy-MM-dd keys, not the Date objects (which are new
    // each render and would otherwise re-fire this POST on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, fromKey, toKey]);

  const toggleSort = (key: 'department' | 'employee_id' | 'name' | 'gender' | 'session' | 'booking_id') => {
    setPage(1);
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const SortIndicator = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => {
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />;
    return dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />;
  };

  // In/Out now sourced directly from gym_reports (TimeIn/TimeOut)

  // Render In/Out in gym wall-clock time regardless of the browser TZ. BOTH sources
  // already carry the gym wall-clock in the ISO *time component*: the liveTapMap
  // overlay as '...HH:MM:SS+08:00' (built by the backend toUtc8Iso helper) and the
  // gym_reports fallback as '...HH:MM:SSZ' (the naive stored wall-clock serialized
  // with a 'Z'). They do NOT represent the same instant, so a blanket +8h shift is
  // wrong for the 'Z' source. Read the HH:MM literally from the string instead.
  const formatTimeOnly = (iso: string | null): string => {
    if (!iso) return '-';
    const s = String(iso);
    const m = /T(\d{2}):(\d{2})/.exec(s);
    if (m) return `${m[1]}:${m[2]}`;
    const d = new Date(s);
    if (isNaN(d.getTime())) return '-';
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  };

  // Filter options come from the backend (distinct over the whole date range, not
  // just the current page). Fall back to page-derived values only if absent.
  const departments = (bookingDataRes.departments && bookingDataRes.departments.length > 0)
    ? [...bookingDataRes.departments].sort((a, b) => a.localeCompare(b))
    : Array.from(
        new Set((bookingData || []).map((r) => r.department).filter((d): d is string => Boolean(d && d.trim())))
      ).sort((a, b) => a.localeCompare(b));

  // Sessions are the RAW SessionName values as stored, so the value sent back
  // matches the backend's exact `SessionName = @session` filter (no normalised
  // label vs. stored-value mismatch).
  const sessions = (bookingDataRes.sessions && bookingDataRes.sessions.length > 0)
    ? [...bookingDataRes.sessions].sort((a, b) => a.localeCompare(b))
    : Array.from(
        new Set((bookingData || []).map((r) => String(r.session_name || '').trim()).filter((n): n is string => Boolean(n)))
      ).sort((a, b) => a.localeCompare(b));

  const filteredData = bookingData;

  const pageDateRange = (() => {
    const dates = bookingData.map((r) => {
      const s = String(r.booking_date || '').slice(0, 10);
      const d = s ? new Date(s) : null;
      return d && !isNaN(d.getTime()) ? d : null;
    }).filter((d): d is Date => !!d);
    if (dates.length === 0) return { from: start, to: end };
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    return { from: min, to: max };
  })();

  useEffect(() => {
    if (dateRange === 'all') return;
    const rangeDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (!Number.isFinite(rangeDays) || rangeDays > 45) return;
    // Skip if a live-sync for this exact range is already in flight, so overlapping
    // heavyweight DB write jobs for the same range can't pile up.
    const rangeKey = `${fromKey}__${toKey}`;
    if (liveSyncInFlightKeyRef.current === rangeKey) return;
    liveSyncInFlightKeyRef.current = rangeKey;
    const path = `/gym-live-sync?from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(toKey)}`;
    fetch(`${API_BASES[0]}${path}`)
      .catch(() => fetch(`${API_BASES[1]}${path}`))
      .catch(() => {})
      .finally(() => {
        // Clear only if no newer range has claimed the ref in the meantime.
        if (liveSyncInFlightKeyRef.current === rangeKey) liveSyncInFlightKeyRef.current = null;
      });
    // Stable yyyy-MM-dd keys (see backfill effect) — avoid re-firing every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, fromKey, toKey]);

  const { data: liveTapMap = new Map<string, { time_in: string | null; time_out: string | null; session_name: string | null; time_start: string | null; time_end: string | null }>() } = useQuery({
    queryKey: ['gym-live-status-range', format(pageDateRange.from, 'yyyy-MM-dd'), format(pageDateRange.to, 'yyyy-MM-dd')],
    queryFn: async () => {
      const fromStr = format(pageDateRange.from, 'yyyy-MM-dd');
      const toStr = format(pageDateRange.to, 'yyyy-MM-dd');
      const tryFetch = async (base: string) => {
        const resp = await fetch(`${base}/gym-live-status-range?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`);
        const json = await resp.json();
        if (!json || !json.ok) return [] as Array<{ employee_id: string; date: string; time_in: string | null; time_out: string | null; session_name: string | null; time_start: string | null; time_end: string | null }>;
        const rows = Array.isArray(json.taps) ? json.taps : [];
        return rows.map((r: unknown) => {
          const obj = r as { employee_id?: string; date?: string; time_in?: string | null; time_out?: string | null; session_name?: string | null; time_start?: string | null; time_end?: string | null };
          return {
            employee_id: String(obj.employee_id ?? '').trim(),
            date: String(obj.date ?? ''),
            time_in: obj.time_in != null ? String(obj.time_in) : null,
            time_out: obj.time_out != null ? String(obj.time_out) : null,
            session_name: obj.session_name != null ? String(obj.session_name) : null,
            time_start: obj.time_start != null ? String(obj.time_start) : null,
            time_end: obj.time_end != null ? String(obj.time_end) : null,
          };
        });
      };
      try {
        const rows = await tryFetch('/api');
        const map = new Map<string, { time_in: string | null; time_out: string | null; session_name: string | null; time_start: string | null; time_end: string | null }>();
        rows.forEach((r) => { const key = `${r.employee_id}__${r.date}`; if (r.employee_id && r.date) map.set(key, { time_in: r.time_in, time_out: r.time_out, session_name: r.session_name ?? null, time_start: r.time_start ?? null, time_end: r.time_end ?? null }); });
        return map;
      } catch (_) {
        const rows = await tryFetch('');
        const map = new Map<string, { time_in: string | null; time_out: string | null; session_name: string | null; time_start: string | null; time_end: string | null }>();
        rows.forEach((r) => { const key = `${r.employee_id}__${r.date}`; if (r.employee_id && r.date) map.set(key, { time_in: r.time_in, time_out: r.time_out, session_name: r.session_name ?? null, time_start: r.time_start ?? null, time_end: r.time_end ?? null }); });
        return map;
      }
    },
    enabled: bookingData.length > 0,
    staleTime: 60000,
  });

  // Calculate statistics
  const stats = {
    totalBookings: totalCount,
    timeIn: Number(bookingDataRes.time_in_total || 0),
    timeOut: Number(bookingDataRes.time_out_total || 0),
    male: Number(bookingDataRes.male_total || 0),
    female: Number(bookingDataRes.female_total || 0),
  };

  const statItems: Array<{ key: string; label: string; value: number; icon: ElementType; iconClass: string; bgClass: string }> = [
    { key: 'totalBookings', label: 'Total Bookings', value: stats.totalBookings, icon: Calendar, iconClass: 'text-primary', bgClass: 'bg-primary/10' },
    { key: 'timeIn', label: 'Time In', value: stats.timeIn, icon: Clock, iconClass: 'text-blue-500', bgClass: 'bg-blue-500/10' },
    { key: 'timeOut', label: 'Time Out', value: stats.timeOut, icon: Users, iconClass: 'text-red-500', bgClass: 'bg-red-500/10' },
    { key: 'male', label: 'Male', value: stats.male, icon: Users, iconClass: 'text-blue-500', bgClass: 'bg-blue-500/10' },
    { key: 'female', label: 'Female', value: stats.female, icon: Users, iconClass: 'text-pink-500', bgClass: 'bg-pink-500/10' },
  ];

  const handleExportCSV = async () => {
    const exportLimit = 200;
    const maxPages = 1000; // hard safety cap (~200k rows) against a runaway loop
    const fetchAllRows = async () => {
      let pageParam = 1;
      const all: BookingRecord[] = [];
      while (pageParam <= maxPages) {
        const res = await loadReportsPage(pageParam, exportLimit);
        const total = Number(res.total || 0);
        if (res.rows.length === 0) break;
        all.push(...res.rows);
        if (total > 0 && all.length >= total) break;
        pageParam += 1;
      }
      return all;
    };

    let exportRows = bookingData;
    try {
      const allRows = await fetchAllRows();
      if (allRows.length > 0) {
        exportRows = allRows;
      }
    } catch (_) {
      exportRows = bookingData;
    }

    // The on-screen liveTapMap is scoped to the CURRENT PAGE's date span, so rows
    // outside that span would miss the In/Out/Schedule/Session overlay on export.
    // Fetch a dedicated overlay covering the FULL selected range (fromKey..toKey)
    // — same endpoint/shape as the liveTapMap query — and use it for the CSV. On
    // any failure, fall back to the page-scoped liveTapMap.
    type TapOverlay = { time_in: string | null; time_out: string | null; session_name: string | null; time_start: string | null; time_end: string | null };
    let exportTapMap: Map<string, TapOverlay> = liveTapMap;
    try {
      const fetchRangeTaps = async (base: string) => {
        const resp = await fetch(`${base}/gym-live-status-range?from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(toKey)}`);
        const json = await resp.json();
        if (!json || !json.ok) throw new Error(String(json?.error || 'Request failed'));
        const taps = Array.isArray(json.taps) ? json.taps : [];
        const map = new Map<string, TapOverlay>();
        taps.forEach((r: unknown) => {
          const obj = r as { employee_id?: string; date?: string; time_in?: string | null; time_out?: string | null; session_name?: string | null; time_start?: string | null; time_end?: string | null };
          const employee_id = String(obj.employee_id ?? '').trim();
          const date = String(obj.date ?? '');
          if (!employee_id || !date) return;
          map.set(`${employee_id}__${date}`, {
            time_in: obj.time_in != null ? String(obj.time_in) : null,
            time_out: obj.time_out != null ? String(obj.time_out) : null,
            session_name: obj.session_name != null ? String(obj.session_name) : null,
            time_start: obj.time_start != null ? String(obj.time_start) : null,
            time_end: obj.time_end != null ? String(obj.time_end) : null,
          });
        });
        return map;
      };
      try {
        exportTapMap = await fetchRangeTaps('/api');
      } catch (_) {
        exportTapMap = await fetchRangeTaps('');
      }
    } catch (_) {
      exportTapMap = liveTapMap;
    }

    const headers = ['No', 'Booking ID', 'Date', 'ID Card', 'Name', 'Employee ID', 'Department', 'Gender', 'In', 'Out', 'Time Schedule', 'Session'];
      const rows = exportRows.map((record, idx) => [
      String(idx + 1),
      formatBookingId(record.booking_id),
      formatDateOnly(record.booking_date || record.time_in || record.time_out),
        String(record.card_no ?? ''),
        String((record.name ?? record.employee_name) ?? ''),
        String(record.employee_id ?? ''),
        String(record.department ?? ''),
        getGenderLabel(record.gender),
      formatTimeOnly(exportTapMap.get(`${String(record.employee_id || '').trim()}__${String(record.booking_date || '').slice(0,10)}`)?.time_in ?? record.time_in),
      formatTimeOnly(exportTapMap.get(`${String(record.employee_id || '').trim()}__${String(record.booking_date || '').slice(0,10)}`)?.time_out ?? record.time_out),
      (() => {
        const key = `${String(record.employee_id || '').trim()}__${String(record.booking_date || '').slice(0,10)}`;
        const live = exportTapMap.get(key);
        const start = (live?.time_start ?? record.time_start) ?? null;
        const end = (live?.time_end ?? record.time_end) ?? null;
        if (start && end) return `${start} - ${end}`;
        const sl = String((live?.session_name ?? record.session_name) || '').trim().toLowerCase();
        return sl.startsWith('morning')
          ? '05:00 - 12:00'
          : sl.startsWith('afternoon')
          ? '12:00 - 18:00'
          : sl.includes('evening')
          ? '17:00 - 19:00'
          : sl.includes('night') && sl.includes('1')
          ? '18:00 - 21:00'
          : (sl.includes('night') && sl.includes('2')) || (sl.includes('night') && sl.includes('ramadhan'))
          ? '21:00 - 23:59'
          : '-';
      })(),
        (() => {
          const key = `${String(record.employee_id || '').trim()}__${String(record.booking_date || '').slice(0,10)}`;
          const live = exportTapMap.get(key);
          return String((live?.session_name ?? record.session_name) ?? '');
        })(),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
    // Prepend a UTF-8 BOM so Excel reads accented names / unicode correctly.
    const BOM = String.fromCharCode(0xfeff);
    const blob = new Blob([BOM, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = (() => {
      switch (dateRange) {
        case 'all':
          return 'gym-attendance-all.csv';
        case 'today':
          return 'gym-attendance-today.csv';
        case 'yesterday':
          return 'gym-attendance-yesterday.csv';
        case 'week':
          return 'gym-attendance-this-week.csv';
        case 'month':
          return 'gym-attendance-this-month.csv';
        case 'year':
          return 'gym-attendance-this-year.csv';
        case 'custom':
        default:
          return `gym-attendance-${format(start, 'yyyy-MM-dd')}-to-${format(end, 'yyyy-MM-dd')}.csv`;
      }
    })();
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 md:-mb-6">
      <Card className="flex w-full flex-col rounded-none md:min-h-[calc(100svh-3.5rem)] md:rounded-xl md:rounded-t-none md:border-t-0">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-semibold flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </span>
                Attendance Reports
              </CardTitle>
              <CardDescription>View and export gym attendance data</CardDescription>
            </div>
            <Button onClick={handleExportCSV} disabled={filteredData.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pt-6">
          <div className="space-y-6">

            <div className="rounded-xl border bg-card shadow-sm p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <div className="text-lg font-semibold">Date Filter</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-start">
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="yesterday">Yesterday</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    {dateRange === 'all' ? (
                      <>Showing: All Time</>
                    ) : (
                      <>Showing: {format(start, 'MMM d, yyyy')} - {format(end, 'MMM d, yyyy')}</>
                    )}
                  </div>
                </div>

                {dateRange === 'custom' && (
                  <>
                    <DatePickerField
                      label="Start Date"
                      value={customStartDate}
                      onChange={setCustomStartDate}
                      placeholder="Pick a start date"
                      disabled={parseLocalDate(customEndDate) ? { after: parseLocalDate(customEndDate) } : undefined}
                    />
                    <DatePickerField
                      label="End Date"
                      value={customEndDate}
                      onChange={setCustomEndDate}
                      placeholder="Pick an end date"
                      disabled={parseLocalDate(customStartDate) ? { before: parseLocalDate(customStartDate) } : undefined}
                    />
                  </>
                )}

                <div className="space-y-2">
                  <Label>Employee ID</Label>
                  <Input type="text" value={filterEmpId} onChange={(e) => setFilterEmpId(e.target.value)} placeholder="Search by ID" className="w-full" />
                </div>

                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={filterDept} onValueChange={(v) => setFilterDept(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {departments.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={filterGender} onValueChange={(v) => setFilterGender(v as 'all' | 'Male' | 'Female')}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Session</Label>
                  <Select value={filterSession} onValueChange={(v) => setFilterSession(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {sessions.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

        {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {statItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${item.bgClass}`}>
                        <Icon className={`h-5 w-5 ${item.iconClass}`} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        <p className="text-2xl font-bold">{item.value}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

        {/* Attendance Table */}
        <Card className="rounded-xl border bg-card shadow-sm">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Reports</CardTitle>
            </div>
            <CardDescription>
              {filteredData.length} records on this page
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {bookingsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : bookingsError ? (
              <div className="text-center py-12 text-red-600">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-60" />
                <p className="font-medium">Failed to load reports.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {String((bookingsErrorObj as Error | undefined)?.message || 'Please try again or check the server.')}
                </p>
              </div>
            ) : bookingData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No attendance records found for this period.</p>
              </div>
            ) : (
              <div className="space-y-4">
              <div className="rounded-xl border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">No</TableHead>
                      <TableHead>
                        <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('booking_id')}>
                          Booking ID
                          <SortIndicator active={sortBy === 'booking_id'} dir={sortDir} />
                        </button>
                      </TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>ID Card</TableHead>
                      <TableHead>
                        <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('name')}>
                          Name
                          <SortIndicator active={sortBy === 'name'} dir={sortDir} />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('employee_id')}>
                          Employee ID
                          <SortIndicator active={sortBy === 'employee_id'} dir={sortDir} />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('department')}>
                          Department
                          <SortIndicator active={sortBy === 'department'} dir={sortDir} />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('gender')}>
                          Gender
                          <SortIndicator active={sortBy === 'gender'} dir={sortDir} />
                        </button>
                      </TableHead>
                      <TableHead>In</TableHead>
                      <TableHead>Out</TableHead>
                      <TableHead>Time Schedule</TableHead>
                      <TableHead>
                        <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('session')}>
                          Session
                          <SortIndicator active={sortBy === 'session'} dir={sortDir} />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((record, idx) => (
                      <TableRow key={`${record.booking_id}-${idx}`}>
                        <TableCell className="font-mono text-sm">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{formatBookingId(record.booking_id)}</TableCell>
                        <TableCell className="font-mono text-sm">{formatDateOnly(record.booking_date || record.time_in || record.time_out)}</TableCell>
                        <TableCell className="font-mono text-sm">{record.card_no || '-'}</TableCell>
                        <TableCell className="text-sm">{(record.name ?? record.employee_name) || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{record.employee_id || '-'}</TableCell>
                        <TableCell>{record.department || '-'}</TableCell>
                        <TableCell className="font-medium">{getGenderChip(record.gender)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatTimeOnly(liveTapMap.get(`${String(record.employee_id || '').trim()}__${String(record.booking_date || '').slice(0,10)}`)?.time_in ?? record.time_in)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatTimeOnly(liveTapMap.get(`${String(record.employee_id || '').trim()}__${String(record.booking_date || '').slice(0,10)}`)?.time_out ?? record.time_out)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {(() => {
                            const key = `${String(record.employee_id || '').trim()}__${String(record.booking_date || '').slice(0,10)}`;
                            const live = liveTapMap.get(key);
                            const start = (live?.time_start ?? record.time_start) ?? null;
                            const end = (live?.time_end ?? record.time_end) ?? null;
                            const text = start && end ? `${start} - ${end}` : (start || '');
                            const sess = (live?.session_name ?? record.session_name) ?? null;
                            return getScheduleChip(sess, text);
                          })()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {(() => {
                            const key = `${String(record.employee_id || '').trim()}__${String(record.booking_date || '').slice(0,10)}`;
                            const live = liveTapMap.get(key);
                            const sess = (live?.session_name ?? record.session_name) ?? null;
                            return getSessionChip(sess);
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="6">6</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    Prev
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => (p < Math.ceil(totalCount / pageSize) ? p + 1 : p))} disabled={page >= Math.ceil(totalCount / pageSize)}>
                    Next
                  </Button>
                </div>
              </div>
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}
