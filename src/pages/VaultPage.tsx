import { Database, AlertCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useVaultUsers, VaultUser } from '@/hooks/useVaultUsers';
import { useGymDbSessions } from '@/hooks/useGymDbSessions';

const JAKARTA_OFFSET_MINUTES = 7 * 60;

function toJakartaHhMm(ts: string): string {
  const d = new Date(ts);
  const local = new Date(d.getTime() + JAKARTA_OFFSET_MINUTES * 60_000);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function VaultPage() {
  const { data: vaultUsers, isLoading: isLoadingVault, error: vaultError } = useVaultUsers();
  const { data: gymDbSessions, isLoading: isLoadingGymDbSessions } = useGymDbSessions();

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
                  <TableHead>Employee ID</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead className="hidden md:table-cell">Session</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vaultUsers.map((user, index) => (
                  <TableRow key={`${user.employee_id}__${user.schedule_time}__${index}`}>
                    <TableCell className="w-12 text-right">{index + 1}</TableCell>
                    <TableCell className="hidden md:table-cell">{user.card_no || '-'}</TableCell>
                    <TableCell className="font-medium">{user.name || '-'}</TableCell>
                    <TableCell>{user.employee_id}</TableCell>
                    <TableCell className="hidden md:table-cell">{user.department || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">{sessionNameFor(user)}</TableCell>
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
