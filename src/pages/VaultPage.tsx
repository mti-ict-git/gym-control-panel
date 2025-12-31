import { Database, AlertCircle, CheckCircle, XCircle, Clock, Check, X, IdCard, Users as UsersIcon, CalendarDays, Lock, Unlock, Search } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useVaultUsers, VaultUser } from '@/hooks/useVaultUsers';
import { useGymDbSessions } from '@/hooks/useGymDbSessions';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

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

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Clock className="h-5 w-5 text-muted-foreground" />;
  const s = status.toUpperCase();
  if (s === 'APPROVED') return <CheckCircle className="h-5 w-5 text-green-500" />;
  if (s === 'REJECTED') return <XCircle className="h-5 w-5 text-red-500" />;
  return <Clock className="h-5 w-5 text-yellow-500" />;
}

export default function VaultPage() {
  const queryClient = useQueryClient();
  const { data: vaultUsers, isLoading: isLoadingVault, error: vaultError } = useVaultUsers();
  const { data: gymDbSessions, isLoading: isLoadingGymDbSessions } = useGymDbSessions();
  const [search, setSearch] = useState('');

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
      queryClient.invalidateQueries({ queryKey: ['vault-users'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    },
  });

  const isLoading = isLoadingVault || isLoadingGymDbSessions;

  const timeToSessionName = new Map((gymDbSessions || []).map((s) => [s.time_start, s.session_name]));

  const sessionNameFor = (user: VaultUser): string => {
    const hhmm = toJakartaHhMm(user.schedule_time);
    return timeToSessionName.get(hhmm) || '-';
  };

  const filteredUsers = (vaultUsers || []).filter((user) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const fields = [
      user.name,
      user.employee_id,
      user.department,
      user.card_no ? String(user.card_no) : '',
      formatBookingId(user.booking_id),
    ];
    return fields.some((f) => String(f || '').toLowerCase().includes(q));
  });

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
        </div>

        {vaultError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Load Error</AlertTitle>
            <AlertDescription>
              Unable to load booking data. Please try again.
            </AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : vaultUsers && vaultUsers.length > 0 ? (
          <>
            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, ID, department, card or booking"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="h-2" />
            <div className="md:hidden">
              <div className="space-y-3">
                {filteredUsers.map((user, index) => (
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
                          <div><SessionBadge name={sessionNameFor(user)} /></div>
                        </div>
                        <div className="col-span-6">
                          <div className="text-muted-foreground">Time Schedule</div>
                          <div>{user.time_start && user.time_end ? `${user.time_start} - ${user.time_end}` : user.time_start || '-'}</div>
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
                                <div>{user.gender || '-'}</div>
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
                      <TableHead>Booking ID</TableHead>
                      <TableHead className="hidden md:table-cell">ID Card</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Gender</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead className="hidden md:table-cell">Department</TableHead>
                      <TableHead className="hidden md:table-cell">Session</TableHead>
                      <TableHead className="hidden md:table-cell">Time Schedule</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user, index) => (
                      <TableRow key={`${user.employee_id}__${user.schedule_time}__${index}`}>
                        <TableCell className="w-12 text-right">{index + 1}</TableCell>
                        <TableCell className="font-mono">{formatBookingId(user.booking_id)}</TableCell>
                        <TableCell className="hidden md:table-cell">{user.card_no || '-'}</TableCell>
                        <TableCell className="font-medium">{user.name || '-'}</TableCell>
                        <TableCell className="hidden md:table-cell">{user.gender || '-'}</TableCell>
                        <TableCell>{user.employee_id}</TableCell>
                        <TableCell className="hidden md:table-cell">{user.department || '-'}</TableCell>
                        <TableCell className="hidden md:table-cell"><SessionBadge name={sessionNameFor(user)} /></TableCell>
                        <TableCell className="hidden md:table-cell">
                          {user.time_start && user.time_end ? `${user.time_start} - ${user.time_end}` : user.time_start || '-'}
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Bookings</AlertTitle>
            <AlertDescription>
              No booking data available.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
