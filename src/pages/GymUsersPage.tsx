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
import { useCardTransactions } from '@/hooks/useCardTransactions';

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
  const { data: liveTx, isLoading: isLoadingTx } = useCardTransactions();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Live Gym Monitoring</h1>
          <p className="text-muted-foreground">Real-time overview of active gym members and access status.</p>
        </div>

        {isLoading || isLoadingTx ? (
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
                    <TableHead>Card No</TableHead>
                    <TableHead>Controller</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(liveTx ?? []).map((t, idx) => (
                    <TableRow key={`${t.CardNo}-${t.TxnTime}-${idx}`}>
                      <TableCell className="w-12 text-right">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{t.TrName ?? '-'}</TableCell>
                      <TableCell>{t.CardNo ?? '-'}</TableCell>
                      <TableCell>{t.TrController ?? '-'}</TableCell>
                      <TableCell>{t.Transaction ?? '-'}</TableCell>
                      <TableCell>{t.TrDate ?? '-'}</TableCell>
                      <TableCell>{t.TrTime ?? '-'}</TableCell>
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
