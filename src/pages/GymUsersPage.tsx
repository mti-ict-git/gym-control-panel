import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Database, Search } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGymUsers, GymUser } from '@/hooks/useGymUsers';
import { useMostRelevantSchedule } from '@/hooks/useGymSchedules';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from '@/components/ui/pagination';
import { useGymLiveStatus } from '@/hooks/useGymLiveStatus';

function UserRow({ user, index, onClick }: { user: GymUser; index: number; onClick: () => void }) {
  const { data: schedule } = useMostRelevantSchedule(user.id);
  
  return (
    <TableRow 
      className="row-interactive"
      onClick={onClick}
    >
      <TableCell className="w-12 text-right">{index}</TableCell>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell>{user.employee_id}</TableCell>
      <TableCell>{user.department || '-'}</TableCell>
      <TableCell>
        {schedule ? (
          format(new Date(schedule.schedule_time), 'MMM d, h:mm a')
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {schedule?.check_in_time ? (
          format(new Date(schedule.check_in_time), 'h:mm a')
        ) : '-'}
      </TableCell>
      <TableCell>
        {schedule?.check_out_time ? (
          format(new Date(schedule.check_out_time), 'h:mm a')
        ) : '-'}
      </TableCell>
      <TableCell>
        {schedule ? <StatusBadge status={schedule.status} /> : <span className="text-muted-foreground">-</span>}
      </TableCell>
    </TableRow>
  );
}

export default function GymUsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useGymUsers(search, page, pageSize);
  const users = [];
  const total = 0;
  const totalPages = 1;
  const { data: liveStatus, isLoading: isLoadingStatus } = useGymLiveStatus();

  const formatTimeUtc8 = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString(undefined, { timeZone: 'Asia/Singapore' });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Live Gym Monitoring</h1>
          <p className="text-muted-foreground">Real-time overview of active gym members and access status.</p>
        </div>

        {isLoading || isLoadingStatus ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-right">No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>ID Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(liveStatus ?? []).map((p, idx) => (
                    <TableRow key={`${p.employee_id}-${p.time_in}-${idx}`}>
                      <TableCell className="w-12 text-right">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{p.name ?? '-'}</TableCell>
                      <TableCell>{p.employee_id ?? '-'}</TableCell>
                      <TableCell>{p.department ?? '-'}</TableCell>
                      <TableCell>{p.schedule ?? '-'}</TableCell>
                      <TableCell>{formatTimeUtc8(p.time_in)}</TableCell>
                      <TableCell>{formatTimeUtc8(p.time_out)}</TableCell>
                      <TableCell>{p.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            
          </div>
        )}
      </div>
    </AppLayout>
  );
}
