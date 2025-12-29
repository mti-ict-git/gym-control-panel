import { useState } from 'react';
import { Calendar as CalendarIcon, List, Plus } from 'lucide-react';
import { useGymDbSessions, GymDbSession } from '@/hooks/useGymDbSessions';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { GymSession, formatTime } from '@/hooks/useGymSessions';
import { WeeklyCalendar } from '@/components/schedules/WeeklyCalendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SessionDialog } from '@/components/schedules/SessionDialog';
import { toast } from 'sonner';

export default function SchedulesPage() {
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);

  const { data: sessions, isLoading, refetch } = useGymDbSessions();
  const endpoint = import.meta.env.VITE_DB_TEST_ENDPOINT as string | undefined;

  const endFor = (label: string): string | null => {
    switch (label) {
      case 'Morning':
        return '06:30';
      case 'Night 1':
        return '20:00';
      case 'Night 2':
        return '22:00';
      default:
        return null;
    }
  };

  const calendarSessions: GymSession[] = (sessions || []).map((s: GymDbSession, idx) => {
    const timeEnd = s.time_end ?? endFor(s.session_name) ?? '00:00';
    return {
      id: `gymdb-${s.session_name}-${s.time_start}-${idx}`,
      session_name: s.session_name,
      time_start: s.time_start,
      time_end: timeEnd,
      quota: s.quota,
      created_at: '',
      updated_at: '',
    };
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Schedules</h1>
            <p className="text-muted-foreground">Manage gym sessions and view calendar.</p>
          </div>
        </div>

        <Tabs defaultValue="sessions" className="w-full">
          <TabsList>
            <TabsTrigger value="sessions" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Calendar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => setSessionDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Session
              </Button>
            </div>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : sessions && sessions.length > 0 ? (
              <div className="rounded-lg border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">No</TableHead>
                      <TableHead>Session</TableHead>
                      <TableHead>Time Start</TableHead>
                      <TableHead>Time End</TableHead>
                      <TableHead>Quota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session, index) => (
                      <TableRow key={`${session.session_name}-${session.time_start}-${index}`}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="font-medium">{session.session_name}</TableCell>
                        <TableCell>{formatTime(session.time_start)}</TableCell>
                        <TableCell>{session.time_end ? formatTime(session.time_end) : '-'}</TableCell>
                        <TableCell>{session.quota}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                icon={CalendarIcon}
                title="No sessions found"
                description="No session data available from GymDB yet."
              />
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <WeeklyCalendar 
              sessions={calendarSessions} 
            />
          </TabsContent>
        </Tabs>
      </div>


      <SessionDialog
        open={sessionDialogOpen}
        onOpenChange={setSessionDialogOpen}
        onSubmit={async (data) => {
          try {
            if (!endpoint) throw new Error('DB tester endpoint is not configured');
            const resp = await fetch(`${endpoint}/gym-session-create`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session_name: data.session_name,
                time_start: data.time_start,
                time_end: data.time_end,
                quota: data.quota,
              }),
            });
            const json = await resp.json();
            if (!json?.ok) throw new Error(json?.error || 'Failed to create session');
            toast.success('Session created');
            setSessionDialogOpen(false);
            refetch();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to create session');
          }
        }}
        isLoading={false}
      />
    </AppLayout>
  );
}
