import { useEffect, useState } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, addDays } from 'date-fns';
import { FileText, Download, Calendar, Users, Clock, TrendingUp, Filter, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
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
import { useQuery } from '@tanstack/react-query';

type DateRange = 'today' | 'next2days' | 'yesterday' | 'week' | 'month' | 'year' | 'custom' | 'all';

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
}

function formatBookingId(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-';
  return `GYMBOOK${String(n)}`;
}

function getDateRange(range: DateRange, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const now = new Date();
  
    switch (range) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'next2days':
        return { start: startOfDay(now), end: endOfDay(addDays(now, 2)) };
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
  if (s === 'night - 1' || s === 'night-1' || s === 'night1') {
    return (
      <span className="inline-flex items-center rounded-md bg-purple-100 text-purple-700 border border-purple-200 px-2 py-1 text-xs font-medium">
        Night - 1
      </span>
    );
  }
  if (s === 'night - 2' || s === 'night-2' || s === 'night2') {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-100 text-amber-700 border border-amber-200 px-2 py-1 text-xs font-medium">
        Night - 2
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
  const [dateRange, setDateRange] = useState<DateRange>('all');
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

  const { start, end } = getDateRange(
    dateRange,
    customStartDate ? new Date(customStartDate) : undefined,
    customEndDate ? new Date(customEndDate) : undefined
  );

  const isLoading = false;

  const { data: bookingDataRes = { rows: [], total: 0 } as ReportQueryResult, isLoading: bookingsLoading } = useQuery<ReportQueryResult>({
    queryKey: ['gym-reports', dateRange, customStartDate, customEndDate, page, pageSize, sortBy, sortDir],
    queryFn: async () => {
      const fromStr = format(start, 'yyyy-MM-dd');
      const toStr = format(end, 'yyyy-MM-dd');
      const tryFetch = async (base: string) => {
        const resp = await fetch(`${base}/gym-reports?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(pageSize))}&sort_by=${encodeURIComponent(String(sortBy || ''))}&sort_dir=${encodeURIComponent(String(sortDir))}`);
        const json = await resp.json();
        if (!json || !json.ok) return { rows: [], total: 0 } as ReportQueryResult;
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
            status: null,
          } as BookingRecord;
        }) as BookingRecord[];
        return { rows: mapped, total: Number(json.total || 0) } as ReportQueryResult;
      };
      try {
        const data = await tryFetch('/api');
        if (data && Array.isArray(data.rows)) return data;
        return await tryFetch('');
      } catch (_) {
        return await tryFetch('');
      }
    },
  });

  const bookingData = bookingDataRes.rows;
  const totalCount = bookingDataRes.total;

  useEffect(() => {
    setPage(1);
  }, [dateRange, customStartDate, customEndDate, sortBy, sortDir]);

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

  const { data: liveRange = [] } = useQuery({
    queryKey: ['gym-live-status-range', dateRange, customStartDate, customEndDate],
    queryFn: async () => {
      const fromStr = format(start, 'yyyy-MM-dd');
      const toStr = format(end, 'yyyy-MM-dd');
      const tryFetch = async (base: string) => {
        const resp = await fetch(`${base}/gym-live-status-range?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`);
        const json = await resp.json();
        if (!json || !json.ok) return [] as LiveTapRange[];
        const taps = Array.isArray(json.taps) ? json.taps : [];
        return taps.map((t: unknown) => {
          const obj = t as { employee_id?: string; date?: string; time_in?: string | null; time_out?: string | null };
          return {
            employee_id: String(obj.employee_id || ''),
            date: String(obj.date || ''),
            time_in: obj.time_in != null ? String(obj.time_in) : null,
            time_out: obj.time_out != null ? String(obj.time_out) : null,
          } as LiveTapRange;
        });
      };
      try {
        const data = await tryFetch('/api');
        if (Array.isArray(data)) return data;
        return await tryFetch('');
      } catch (_) {
        return await tryFetch('');
      }
    },
    staleTime: 5000,
  });

  const liveMap = new Map<string, { time_in: string | null; time_out: string | null }>(
    (liveRange || []).map((p) => [`${p.employee_id}__${p.date}`, { time_in: p.time_in, time_out: p.time_out }])
  );

  const formatTimeOnly = (iso: string | null): string => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return format(d, 'HH:mm');
  };

  const departments = Array.from(
    new Set((bookingData || []).map((r) => r.department).filter((d): d is string => Boolean(d && d.trim())))
  ).sort((a, b) => a.localeCompare(b));

  const normalizeSession = (s: string | null): string => {
    const v = String(s || '').trim().toLowerCase();
    if (!v) return '';
    if (v === 'morning') return 'Morning';
    if (v === 'afternoon') return 'Afternoon';
    if (v === 'night - 1' || v === 'night-1' || v === 'night1') return 'Night - 1';
    if (v === 'night - 2' || v === 'night-2' || v === 'night2') return 'Night - 2';
    return s || '';
  };

  const sessions = Array.from(
    new Set((bookingData || []).map((r) => normalizeSession(r.session_name)).filter((n): n is string => Boolean(n && n.trim())))
  ).sort((a, b) => a.localeCompare(b));

  const filteredData = (bookingData || []).filter((r) => {
    const empIdOk = filterEmpId.trim() === '' || String(r.employee_id || '').toLowerCase().includes(filterEmpId.trim().toLowerCase());
    const deptOk = filterDept === 'all' || String(r.department || '') === filterDept;
    const genderLabel = getGenderLabel(r.gender);
    const genderOk = filterGender === 'all' || genderLabel === filterGender;
    const sessionLabel = normalizeSession(r.session_name);
    const sessionOk = filterSession === 'all' || sessionLabel === filterSession;
    return empIdOk && deptOk && genderOk && sessionOk;
  });

  // Calculate statistics
  const stats = {
    totalBookings: filteredData.length,
    checkedIn: filteredData.filter(r => (r.status || '').toUpperCase() === 'CHECKIN').length,
    completed: filteredData.filter(r => (r.status || '').toUpperCase() === 'COMPLETED').length,
    noShow: filteredData.filter(r => (r.status || '').toUpperCase() === 'NO_SHOW').length,
    uniqueUsers: new Set(filteredData.map(r => r.employee_id)).size,
  };

  const handleExportCSV = () => {
    const headers = ['No', 'Booking ID', 'Card No', 'Name', 'Employee ID', 'Department', 'Gender', 'In', 'Out', 'Time Schedule', 'Session'];
    const rows = filteredData.map((record, idx) => [
      String(idx + 1),
      formatBookingId(record.booking_id),
      String(record.card_no ?? ''),
      String((record.name ?? record.employee_name) ?? ''),
      String(record.employee_id ?? ''),
      String(record.department ?? ''),
      String(record.gender ?? ''),
      formatTimeOnly((liveMap.get(`${String(record.employee_id)}__${String(record.booking_date)}`) || { time_in: null, time_out: null }).time_in),
      formatTimeOnly((liveMap.get(`${String(record.employee_id)}__${String(record.booking_date)}`) || { time_in: null, time_out: null }).time_out),
      record.time_start && record.time_end
        ? `${record.time_start} - ${record.time_end}`
        : String(record.time_start ?? ''),
      String(record.session_name ?? ''),
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = (() => {
      switch (dateRange) {
        case 'all':
          return 'gym-attendance-all.csv';
        case 'next2days':
          return 'gym-attendance-next-2-days.csv';
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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Attendance Reports</h1>
            <p className="text-muted-foreground">
              View and export gym attendance data
            </p>
          </div>
          <Button onClick={handleExportCSV} disabled={filteredData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Date Filter</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
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
                    <SelectItem value="next2days">Next 2 Days</SelectItem>
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
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input
                  type="text"
                  value={filterEmpId}
                  onChange={(e) => setFilterEmpId(e.target.value)}
                  placeholder="Search by ID"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={filterDept} onValueChange={(v) => setFilterDept(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
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
                    {sessions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-bold">{stats.totalBookings}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Checked In</p>
                  <p className="text-2xl font-bold">{stats.checkedIn}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-500/10 p-2">
                  <Users className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">No Show</p>
                  <p className="text-2xl font-bold">{stats.noShow}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-500/10 p-2">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unique Users</p>
                  <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Reports</CardTitle>
            </div>
            <CardDescription>
              {filteredData.length} records on this page
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : bookingData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No attendance records found for this period.</p>
              </div>
            ) : (
              <div className="space-y-4">
              <div className="rounded-md border overflow-x-auto">
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
                      <TableHead>Card No</TableHead>
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
                        <TableCell className="font-mono text-sm">{record.card_no || '-'}</TableCell>
                        <TableCell className="text-sm">{(record.name ?? record.employee_name) || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{record.employee_id || '-'}</TableCell>
                        <TableCell>{record.department || '-'}</TableCell>
                        <TableCell className="font-medium">{getGenderChip(record.gender)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatTimeOnly((liveMap.get(`${String(record.employee_id)}__${String(record.booking_date)}`) || { time_in: null, time_out: null }).time_in)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatTimeOnly((liveMap.get(`${String(record.employee_id)}__${String(record.booking_date)}`) || { time_in: null, time_out: null }).time_out)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {record.time_start && record.time_end
                            ? `${record.time_start} - ${record.time_end}`
                            : record.time_start || '-'}
                        </TableCell>
                        <TableCell className="font-medium">{getSessionChip(record.session_name)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
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
    </AppLayout>
  );
}
