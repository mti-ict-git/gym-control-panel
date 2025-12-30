import { Database, AlertCircle, CheckCircle, XCircle, Clock, Check, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useVaultUsers, VaultUser } from '@/hooks/useVaultUsers';
import { useGymDbSessions } from '@/hooks/useGymDbSessions';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

const JAKARTA_OFFSET_MINUTES = 7 * 60;

function toJakartaHhMm(ts: string): string {
  const d = new Date(ts);
  const local = new Date(d.getTime() + JAKARTA_OFFSET_MINUTES * 60_000);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-right">No</TableHead>
              <TableHead className="hidden md:table-cell">ID Card</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Gender</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead className="hidden md:table-cell">Session</TableHead>
              <TableHead className="hidden md:table-cell">Time</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
              <TableBody>
                {vaultUsers.map((user, index) => (
                  <TableRow key={`${user.employee_id}__${user.schedule_time}__${index}`}>
                    <TableCell className="w-12 text-right">{index + 1}</TableCell>
                    <TableCell className="hidden md:table-cell">{user.card_no || '-'}</TableCell>
                    <TableCell className="font-medium">{user.name || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">{user.gender || '-'}</TableCell>
                    <TableCell>{user.employee_id}</TableCell>
                    <TableCell className="hidden md:table-cell">{user.department || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">{sessionNameFor(user)}</TableCell>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
