import { Database, AlertCircle, CheckCircle, XCircle, Clock, Check, X, IdCard, Users as UsersIcon, User, CalendarDays, Lock, Unlock, ArrowUpDown, ChevronUp, ChevronDown, Filter, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useVaultUsersPaged, VaultUser } from '@/hooks/useVaultUsers';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useUserRole } from '@/hooks/useUserRole';

const UTC8_OFFSET_MINUTES = 8 * 60;

function toJakartaHhMm(ts: string): string {
  const d = new Date(ts);
  const local = new Date(d.getTime() + UTC8_OFFSET_MINUTES * 60_000);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatBookingId(n: number): string {
  const s = String(n);
  const padded = s.padStart(2, '0');
  return `GYMBOOK${padded}`;
}

function SessionBadge({ name }: { name: string }) {
  const key = name.toLowerCase();
  const color = key.includes('morning')
    ? 'bg-green-100 text-green-900'
    : key.includes('afternoon')
    ? 'bg-blue-100 text-blue-900'
    : key.includes('night') && (key.includes('1') || key.includes('- 1'))
    ? 'bg-purple-100 text-purple-900'
    : key.includes('night') && (key.includes('2') || key.includes('- 2'))
    ? 'bg-amber-100 text-amber-900'
    : 'bg-slate-100 text-slate-900';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md font-medium ${color}`}>{name}</span>
  );
}

function TimeScheduleBadge({ session, start, end }: { session: string | null; start: string | null; end: string | null }) {
  const key = String(session || '').toLowerCase();
  const color = key.includes('morning')
    ? 'bg-green-100 text-green-900'
    : key.includes('afternoon')
    ? 'bg-blue-100 text-blue-900'
    : key.includes('night') && (key.includes('1') || key.includes('- 1'))
    ? 'bg-purple-100 text-purple-900'
    : key.includes('night') && (key.includes('2') || key.includes('- 2'))
    ? 'bg-amber-100 text-amber-900'
    : 'bg-slate-100 text-slate-900';
  const text = start && end ? `${start} - ${end}` : start ? start : 'COMITTE';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md font-medium ${color}`}>{text}</span>;
}

function GenderBadge({ gender }: { gender: string | null }) {
  if (!gender) return <span className="text-muted-foreground">-</span>;
  const g = gender.trim().toLowerCase();

  const style =
    g === 'male' || g === 'm'
      ? 'bg-blue-100 text-blue-900 border-blue-200'
      : g === 'female' || g === 'f'
      ? 'bg-pink-100 text-pink-900 border-pink-200'
      : 'bg-slate-100 text-slate-900 border-slate-200';

  const label = g === 'm' ? 'Male' : g === 'f' ? 'Female' : gender;

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Clock className="h-5 w-5 text-muted-foreground" />;
  const s = status.toUpperCase();
  if (s === 'APPROVED') return <CheckCircle className="h-5 w-5 text-green-500" />;
  if (s === 'REJECTED') return <XCircle className="h-5 w-5 text-red-500" />;
  return <Clock className="h-5 w-5 text-yellow-500" />;
}

export default function VaultPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<
    'booking_id' | 'booking_date' | 'time_start' | 'time_end' | 'name' | 'employee_id' | 'department' | 'approval_status' | 'status'
  >('booking_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const {
    data: bookingPaged = { rows: [], total: 0 },
    isLoading: isLoadingVault,
    error: vaultError,
  } = useVaultUsersPaged({
    q: '',
    page,
    pageSize,
    sortBy,
    sortDir,
  });

  const vaultUsers = bookingPaged.rows;
  const totalCount = bookingPaged.total;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const toggleAccessMutation = useMutation({
    mutationFn: async ({ employee_id, grant_access }: { employee_id: string; grant_access: boolean }) => {
      const tryPost = async (url: string) => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id, access: grant_access }),
        });
        const j = await r.json();
        if (r.status >= 500) throw new Error(j?.error || 'Server error');
        return j as { ok: boolean; error?: string };
      };

      let json: { ok: boolean; error?: string } = { ok: false };
      try {
        json = await tryPost(`/api/gym-controller-access`);
      } catch (_) {
        json = await tryPost(`/gym-controller-access`);
      }
      if (!json.ok) throw new Error(json.error || 'Failed to update controller access');
      return json;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.grant_access ? 'Gym access granted' : 'Gym access disabled');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Controller update failed');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ booking_id, status }: { booking_id: number; status: 'APPROVED' | 'REJECTED' }) => {
      const tryPost = async (url: string) => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id, approval_status: status }),
        });
        const j = await r.json();
        if (r.status >= 500) throw new Error(j?.error || 'Server error');
        return j;
      };
      let json: { ok: boolean; error?: string } = { ok: false };
      try {
        json = await tryPost(`/api/gym-booking-update-status`);
      } catch (_) {
        json = await tryPost(`/gym-booking-update-status`);
      }
      if (!json.ok) throw new Error(json.error || 'Failed to update status');
      return json;
    },
    onSuccess: () => {
      toast.success('Booking status updated');
      queryClient.invalidateQueries({ queryKey: ['vault-users-paged'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    },
  });

  const isLoading = isLoadingVault;

  const toggleSort = (key: typeof sortBy) => {
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

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BOOKED' | 'IN_GYM' | 'OUT'>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [deleteBookingId, setDeleteBookingId] = useState<number | null>(null);
  const { isCommittee, isSuperAdmin } = useUserRole();

  const apiStatus = (s: typeof statusFilter): 'BOOKED' | 'CHECKIN' | 'COMPLETED' | undefined => {
    if (s === 'BOOKED') return 'BOOKED';
    if (s === 'IN_GYM') return 'CHECKIN';
    if (s === 'OUT') return 'COMPLETED';
    return undefined;
  };

  const {
    data: pagedData = { rows: [], total: 0 },
    isLoading: isLoadingWithFilters,
    error: vaultErrorWithFilters,
  } = useVaultUsersPaged({
    q: search,
    page,
    pageSize,
    status: apiStatus(statusFilter),
    approvalStatus: approvalFilter === 'ALL' ? undefined : approvalFilter,
    sortBy,
    sortDir,
  });

  const vaultUsersFiltered = pagedData.rows;
  const totalCountFiltered = pagedData.total;
  const totalPagesFiltered = Math.max(1, Math.ceil(totalCountFiltered / pageSize));

  const normalizeSession = (s: string | null): string => {
    const v = String(s || '').trim().toLowerCase();
    if (!v || v === '-') return '';
    if (v.startsWith('morning')) return 'Morning';
    if (v.startsWith('afternoon')) return 'Afternoon';
    if (v.startsWith('night - 1') || v.startsWith('night-1') || v.startsWith('night 1') || v.startsWith('night1')) return 'Night - 1';
    if (v.startsWith('night - 2') || v.startsWith('night-2') || v.startsWith('night 2') || v.startsWith('night2')) return 'Night - 2';
    return (s || '').split(/\s+\d/)[0]?.trim() || (s || '');
  };

  const getSessionCountChip = (name: string, count: number) => {
    const lower = name.toLowerCase();
    const color = lower.startsWith('morning')
      ? 'bg-green-100 text-green-700 border-green-200'
      : lower.startsWith('afternoon')
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : lower.includes('night') && lower.includes('1')
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : lower.includes('night') && lower.includes('2')
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
    return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${color}`}>{name}: {count}</span>;
  };

  const getStatusCountChip = (name: string, count: number) => {
    const lower = name.toLowerCase();
    const color = lower === 'booked'
      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
      : lower === 'in_gym'
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
    return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${color}`}>{name}: {count}</span>;
  };

  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = { 'COMITTE': 0, 'Morning': 0, 'Afternoon': 0, 'Night - 1': 0, 'Night - 2': 0, 'Other': 0 };
    (vaultUsersFiltered || []).forEach((u) => {
      const label = normalizeSession(u.session_name);
      if (label === '') counts['COMITTE']++;
      else if (label === 'Morning') counts['Morning']++;
      else if (label === 'Afternoon') counts['Afternoon']++;
      else if (label === 'Night - 1') counts['Night - 1']++;
      else if (label === 'Night - 2') counts['Night - 2']++;
      else counts['Other']++;
    });
    return counts;
  }, [vaultUsersFiltered]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { 'BOOKED': 0, 'IN_GYM': 0, 'OUT': 0 };
    (vaultUsersFiltered || []).forEach((u) => {
      const s = String(u.status || '').toUpperCase();
      if (s === 'BOOKED') counts['BOOKED']++;
      else if (s === 'IN_GYM') counts['IN_GYM']++;
      else counts['OUT']++;
    });
    return counts;
  }, [vaultUsersFiltered]);

  const genderCounts = useMemo(() => {
    let male = 0;
    let female = 0;
    (vaultUsersFiltered || []).forEach((u) => {
      const g = String(u.gender || '').trim().toLowerCase();
      if (!g) return;
      if (g === 'male' || g === 'm') male++;
      else if (g === 'female' || g === 'f') female++;
    });
    return { male, female };
  }, [vaultUsersFiltered]);

  const deleteBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const encodedId = encodeURIComponent(String(bookingId));
      const tryDelete = async (url: string) => {
        const resp = await fetch(url, { method: 'DELETE' });
        const json: { ok: boolean; affected?: number; error?: string } = await resp.json();
        if (!json.ok) {
          throw new Error(json.error || 'Failed to delete booking');
        }
        return json;
      };

      try {
        return await tryDelete(`/api/gym-booking/${encodedId}`);
      } catch (_) {
        return await tryDelete(`/gym-booking/${encodedId}`);
      }
    },
    onSuccess: () => {
      toast.success('Booking deleted');
      queryClient.invalidateQueries({ queryKey: ['vault-users-paged'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to delete booking';
      toast.error(message);
    },
  });
  const canDeleteBooking = isCommittee || isSuperAdmin;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Gym Booking
          </h1>
          <p className="text-muted-foreground">
            Booking list created from the Register page.
          </p>
          <Card className="mt-3">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Search & Filters</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Search</div>
                  <Input
                    placeholder="Search name, employee ID, or card"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Status</div>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      <SelectItem value="BOOKED">BOOKED</SelectItem>
                      <SelectItem value="IN_GYM">IN_GYM</SelectItem>
                      <SelectItem value="OUT">OUT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Approval Status</div>
                  <Select value={approvalFilter} onValueChange={(v) => { setApprovalFilter(v as typeof approvalFilter); setPage(1); }}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      <SelectItem value="PENDING">PENDING</SelectItem>
                      <SelectItem value="APPROVED">APPROVED</SelectItem>
                      <SelectItem value="REJECTED">REJECTED</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <UsersIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Bookings</p>
                        <p className="text-2xl font-bold">{totalCountFiltered}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-blue-500/10 p-2">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Male</p>
                        <p className="text-2xl font-bold">{genderCounts.male}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-pink-500/10 p-2">
                        <User className="h-5 w-5 text-pink-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Female</p>
                        <p className="text-2xl font-bold">{genderCounts.female}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
              </div>
              

              {vaultError ? (
                <div className="mt-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Load Error</AlertTitle>
                    <AlertDescription>
                      Unable to load booking data. Please try again.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : isLoading ? (
                <div className="space-y-4 mt-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : vaultUsersFiltered && vaultUsersFiltered.length > 0 ? (
                <div className="mt-4">
                  <div className="md:hidden">
                    <div className="space-y-3">
                      {vaultUsersFiltered.map((user, index) => (
                        <Card key={`${user.employee_id}__${user.schedule_time}__${index}`}>
                          <CardHeader className="p-3 pb-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <CardTitle className="text-base font-semibold leading-tight line-clamp-1">{user.name || '-'}</CardTitle>
                                <div className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
                                  <IdCard className="h-3.5 w-3.5" />
                                  <span className="font-mono">{user.card_no || '-'}</span>
                                </div>
                              </div>
                              <StatusBadge status={user.approval_status} />
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 pt-1 space-y-2">
                            <div className="grid grid-cols-12 gap-2 text-xs">
                              <div className="col-span-6">
                                <div className="text-muted-foreground">ID</div>
                                <div className="font-mono">{user.employee_id}</div>
                              </div>
                              <div className="col-span-6">
                                <div className="text-muted-foreground">Booking ID</div>
                                <div className="font-mono">{formatBookingId(user.booking_id)}</div>
                              </div>
                              <div className="col-span-6">
                                <div className="text-muted-foreground">Session</div>
                                <div><SessionBadge name={user.session_name || '-'} /></div>
                              </div>
                              <div className="col-span-6">
                                <div className="text-muted-foreground">Time Schedule</div>
                                <div><TimeScheduleBadge session={user.session_name} start={user.time_start} end={user.time_end} /></div>
                              </div>
                              <div className="col-span-6">
                                <div className="text-muted-foreground">Date</div>
                                <div>{user.booking_date}</div>
                              </div>
                            </div>

                            <Accordion type="single" collapsible>
                              <AccordionItem value="details">
                                <AccordionTrigger className="text-xs">Details</AccordionTrigger>
                                <AccordionContent>
                                  <div className="grid grid-cols-12 gap-2 text-xs">
                                    <div className="col-span-6">
                                      <div className="text-muted-foreground">Gender</div>
                                      <div>
                                        <GenderBadge gender={user.gender} />
                                      </div>
                                    </div>
                                    <div className="col-span-12">
                                      <div className="text-muted-foreground">Department</div>
                                      <div>{user.department || '-'}</div>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </CardContent>
                          <CardFooter className="p-3 pt-1 flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => updateStatusMutation.mutate({ booking_id: user.booking_id, status: 'APPROVED' })}
                              disabled={updateStatusMutation.isPending || user.approval_status === 'APPROVED'}
                              aria-label={`Approve booking for ${user.name || user.employee_id}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => updateStatusMutation.mutate({ booking_id: user.booking_id, status: 'REJECTED' })}
                              disabled={updateStatusMutation.isPending || user.approval_status === 'REJECTED'}
                              aria-label={`Reject booking for ${user.name || user.employee_id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => toggleAccessMutation.mutate({ employee_id: user.employee_id, grant_access: true })}
                              disabled={toggleAccessMutation.isPending}
                              aria-label={`Give gym access for ${user.name || user.employee_id}`}
                            >
                              <Unlock className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={() => toggleAccessMutation.mutate({ employee_id: user.employee_id, grant_access: false })}
                              disabled={toggleAccessMutation.isPending}
                              aria-label={`Disable gym access for ${user.name || user.employee_id}`}
                            >
                              <Lock className="h-4 w-4" />
                            </Button>
                            {canDeleteBooking && (
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteBookingId(user.booking_id)}
                                disabled={deleteBookingMutation.isPending}
                                aria-label={`Delete booking for ${user.name || user.employee_id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <div className="rounded-lg border bg-card overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 text-right">No</TableHead>
                            <TableHead>
                              <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('booking_id')}>
                                Booking ID
                                <SortIndicator active={sortBy === 'booking_id'} dir={sortDir} />
                              </button>
                            </TableHead>
                            <TableHead className="hidden md:table-cell">ID Card</TableHead>
                            <TableHead>
                              <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('name')}>
                                Name
                                <SortIndicator active={sortBy === 'name'} dir={sortDir} />
                              </button>
                            </TableHead>
                            <TableHead className="hidden md:table-cell">Gender</TableHead>
                            <TableHead>
                              <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('employee_id')}>
                                Employee ID
                                <SortIndicator active={sortBy === 'employee_id'} dir={sortDir} />
                              </button>
                            </TableHead>
                            <TableHead className="hidden md:table-cell">
                              <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('department')}>
                                Department
                                <SortIndicator active={sortBy === 'department'} dir={sortDir} />
                              </button>
                            </TableHead>
                            <TableHead className="hidden md:table-cell">Session</TableHead>
                            <TableHead className="hidden md:table-cell">
                              <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('time_start')}>
                                Time Schedule
                                <SortIndicator active={sortBy === 'time_start'} dir={sortDir} />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('booking_date')}>
                                Date
                                <SortIndicator active={sortBy === 'booking_date'} dir={sortDir} />
                              </button>
                            </TableHead>
                            <TableHead className="text-center">
                              <button className="inline-flex items-center gap-1 hover:underline" onClick={() => toggleSort('approval_status')}>
                                Status
                                <SortIndicator active={sortBy === 'approval_status'} dir={sortDir} />
                              </button>
                            </TableHead>
                            <TableHead className="text-center">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vaultUsersFiltered.map((user, index) => (
                            <TableRow key={`${user.employee_id}__${user.schedule_time}__${index}`}>
                              <TableCell className="w-12 text-right">{(page - 1) * pageSize + index + 1}</TableCell>
                              <TableCell className="font-mono">{formatBookingId(user.booking_id)}</TableCell>
                              <TableCell className="hidden md:table-cell">{user.card_no || '-'}</TableCell>
                              <TableCell className="font-medium">{user.name || '-'}</TableCell>
                              <TableCell className="hidden md:table-cell">
                                <GenderBadge gender={user.gender} />
                              </TableCell>
                              <TableCell>{user.employee_id}</TableCell>
                              <TableCell className="hidden md:table-cell">{user.department || '-'}</TableCell>
                              <TableCell className="hidden md:table-cell"><SessionBadge name={user.session_name || '-'} /></TableCell>
                              <TableCell className="hidden md:table-cell">
                                <TimeScheduleBadge session={user.session_name} start={user.time_start} end={user.time_end} />
                              </TableCell>
                              <TableCell>{user.booking_date}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center items-center">
                                  <StatusBadge status={user.approval_status} />
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => updateStatusMutation.mutate({ booking_id: user.booking_id, status: 'APPROVED' })}
                                    disabled={updateStatusMutation.isPending || user.approval_status === 'APPROVED'}
                                    title="Approve"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => updateStatusMutation.mutate({ booking_id: user.booking_id, status: 'REJECTED' })}
                                    disabled={updateStatusMutation.isPending || user.approval_status === 'REJECTED'}
                                    title="Reject"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => toggleAccessMutation.mutate({ employee_id: user.employee_id, grant_access: true })}
                                    disabled={toggleAccessMutation.isPending}
                                    title="Give Access"
                                  >
                                    <Unlock className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                    onClick={() => toggleAccessMutation.mutate({ employee_id: user.employee_id, grant_access: false })}
                                    disabled={toggleAccessMutation.isPending}
                                    title="Disable Access"
                                  >
                                    <Lock className="h-4 w-4" />
                                  </Button>
                                  {canDeleteBooking && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => setDeleteBookingId(user.booking_id)}
                                      disabled={deleteBookingMutation.isPending}
                                      title="Delete Booking"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rows per page</span>
                        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                          <SelectTrigger className="w-[90px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Page {page} of {totalPagesFiltered}</span>
                        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</Button>
                        <Button variant="outline" size="sm" onClick={() => setPage((p) => (p < totalPagesFiltered ? p + 1 : p))} disabled={page >= totalPagesFiltered}>Next</Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Bookings</AlertTitle>
                    <AlertDescription>
                      No booking data available.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <AlertDialog
          open={deleteBookingId != null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteBookingId(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Booking</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the selected booking.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setDeleteBookingId(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteBookingId != null && !deleteBookingMutation.isPending) {
                    deleteBookingMutation.mutate(deleteBookingId);
                  }
                }}
                disabled={deleteBookingMutation.isPending}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
