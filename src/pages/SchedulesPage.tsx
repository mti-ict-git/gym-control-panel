import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useGymSchedules, FilterType } from '@/hooks/useGymSchedules';
import { GYM_SESSIONS, getSessionByTime, formatSessionTime, GymSession } from '@/lib/gymSessions';

interface SessionRowData {
  id: string;
  date: Date;
  session: GymSession;
  count: number;
}

export default function SchedulesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const [filter, setFilter] = useState<FilterType>(initialFilter);

  useEffect(() => {
    const filterParam = searchParams.get('filter') as FilterType;
    if (filterParam) {
      setFilter(filterParam);
    }
  }, [searchParams]);

  const { data: schedules, isLoading } = useGymSchedules(filter);

  const filterButtons: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'In Gym', value: 'IN_GYM' },
    { label: 'Booked', value: 'BOOKED' },
    { label: 'Out', value: 'OUT' },
  ];

  const sessionRows = useMemo(() => {
    if (!schedules) return [];

    const rowsMap = new Map<string, SessionRowData>();

    // If filter is 'today', pre-fill with empty sessions for today
    if (filter === 'today') {
      const today = new Date();
      GYM_SESSIONS.forEach(session => {
        const key = `${format(today, 'yyyy-MM-dd')}_${session.id}`;
        rowsMap.set(key, {
          id: key,
          date: today,
          session,
          count: 0
        });
      });
    }

    schedules.forEach(schedule => {
      const date = new Date(schedule.schedule_time);
      const session = getSessionByTime(date);
      
      if (session) {
        const key = `${format(date, 'yyyy-MM-dd')}_${session.id}`;
        const existing = rowsMap.get(key);
        
        if (existing) {
          existing.count++;
        } else {
          // Only add if not pre-filled (which implies filter !== 'today')
          // Or if pre-fill missed it (shouldn't happen for 'today')
          rowsMap.set(key, {
            id: key,
            date: date,
            session,
            count: 1
          });
        }
      }
    });

    return Array.from(rowsMap.values()).sort((a, b) => {
      // Sort by date then by session start time
      const dateCompare = b.date.getTime() - a.date.getTime(); // Newest dates first
      if (dateCompare !== 0) return dateCompare;
      return a.session.startTime.localeCompare(b.session.startTime);
    });
  }, [schedules, filter]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Schedules</h1>
          <p className="text-muted-foreground">View and manage gym session occupancy.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterButtons.map((btn) => (
            <Button
              key={btn.value}
              variant={filter === btn.value ? 'default' : 'outline'}
              onClick={() => setFilter(btn.value)}
              className="touch-target"
              size="sm"
            >
              {btn.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : sessionRows.length > 0 ? (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">No</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Time Range</TableHead>
                  <TableHead>Occupancy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionRows.map((row, index) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.session.nameId}</span>
                        {filter !== 'today' && (
                          <span className="text-xs text-muted-foreground">
                            {format(row.date, 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatSessionTime(row.session)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{row.count}</span>
                      <span className="text-muted-foreground text-xs ml-1">/ 15</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            icon={Calendar}
            title="No sessions found"
            description="No gym sessions data available for the selected filter."
          />
        )}
      </div>
    </AppLayout>
  );
}
