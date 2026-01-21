import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Database, Search, Calendar as CalendarIcon } from 'lucide-react';
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

  const normalizeSession = (s: string | null): string => {
    const v = String(s || '').trim().toLowerCase();
    if (!v) return '';
    if (v.startsWith('morning')) return 'Morning';
    if (v.startsWith('afternoon')) return 'Afternoon';
    if (v.startsWith('night - 1') || v.startsWith('night-1') || v.startsWith('night 1') || v.startsWith('night1')) return 'Night - 1';
    if (v.startsWith('night - 2') || v.startsWith('night-2') || v.startsWith('night 2') || v.startsWith('night2')) return 'Night - 2';
    return (s || '').split(/\s+\d/)[0]?.trim() || (s || '');
  };

  const getSessionChip = (session: string | null) => {
    const s = String(session || '').trim();
    if (!s) return <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 border-slate-200">COMITTE</span>;
    const lower = s.toLowerCase();
    const color = lower.startsWith('morning')
      ? 'bg-green-100 text-green-700 border-green-200'
      : lower.startsWith('afternoon')
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : lower.includes('night') && lower.includes('1')
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : lower.includes('night') && lower.includes('2')
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
    return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${color}`}>{s}</span>;
  };

  const formatDateUtc8 = (isoIn: string | null, isoOut: string | null) => {
    const iso = isoIn || isoOut;
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(undefined, { timeZone: 'Asia/Singapore' });
  };

  const getTimeSchedule = (s: string | null): string => {
    const v = String(s || '').trim();
    if (!v) return 'COMITTE';
    const m = v.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
    const arr = v.match(/\d{1,2}:\d{2}/g);
    if (arr && arr.length >= 2) return `${arr[0]}-${arr[1]}`;
    return 'COMITTE';
  };

  const getScheduleChip = (schedule: string | null) => {
    const text = getTimeSchedule(schedule);
    const label = normalizeSession(schedule);
    const lower = label.toLowerCase();
    const color = lower.startsWith('morning')
      ? 'bg-green-100 text-green-700 border-green-200'
      : lower.startsWith('afternoon')
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : lower.includes('night') && lower.includes('1')
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : lower.includes('night') && lower.includes('2')
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
    return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${color}`}>{text}</span>;
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

  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Morning': 0, 'Afternoon': 0, 'Night - 1': 0, 'Night - 2': 0, 'COMITTE': 0, 'Other': 0 };
    (liveStatus ?? []).forEach((p) => {
      const label = normalizeSession(p.schedule);
      if (label === '') counts['COMITTE']++;
      else if (label === 'Morning') counts['Morning']++;
      else if (label === 'Afternoon') counts['Afternoon']++;
      else if (label === 'Night - 1') counts['Night - 1']++;
      else if (label === 'Night - 2') counts['Night - 2']++;
      else counts['Other']++;
    });
    return counts;
  }, [liveStatus]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Live Gym Monitoring</h1>
          <p className="text-muted-foreground">Real-time overview of active gym members and access status.</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CalendarIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Today's Booking Date</div>
              <div className="text-lg font-semibold">{format(new Date(), 'yyyy-MM-dd')}</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm text-muted-foreground mb-2">Session & Count</div>
            <div className="flex flex-wrap gap-2">
              {getSessionCountChip('COMITTE', sessionCounts['COMITTE'])}
              {getSessionCountChip('Morning', sessionCounts['Morning'])}
              {getSessionCountChip('Afternoon', sessionCounts['Afternoon'])}
              {getSessionCountChip('Night - 1', sessionCounts['Night - 1'])}
              {getSessionCountChip('Night - 2', sessionCounts['Night - 2'])}
              {getSessionCountChip('Other', sessionCounts['Other'])}
            </div>
          </div>
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
                    <TableHead>Session</TableHead>
                    <TableHead>Time Schedule</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Access</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(liveStatus ?? []).map((p, idx) => (
                    <TableRow key={`${p.employee_id}-${p.time_in}-${idx}`}>
                      <TableCell className="w-12 text-right">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{p.name ?? '-'}</TableCell>
                      <TableCell>{p.employee_id ?? '-'}</TableCell>
                      <TableCell>{p.department ?? '-'}</TableCell>
                      <TableCell>{getSessionChip(normalizeSession(p.schedule))}</TableCell>
                      <TableCell>{getScheduleChip(p.schedule)}</TableCell>
                      <TableCell>{formatDateUtc8(p.time_in, p.time_out)}</TableCell>
                      <TableCell>{formatTimeUtc8(p.time_in)}</TableCell>
                      <TableCell>{formatTimeUtc8(p.time_out)}</TableCell>
                      <TableCell>{p.status}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${p.access_indicator.color === 'green' ? 'bg-green-500' : 'bg-red-500'}`}
                          />
                          <span>{p.access_indicator.label}</span>
                        </div>
                      </TableCell>
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
