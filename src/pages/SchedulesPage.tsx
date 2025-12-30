import { useState } from 'react';
import { Calendar as CalendarIcon, List, Pencil, Plus, Trash2 } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function SchedulesPage() {
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<GymDbSession | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState<GymDbSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: sessions, isLoading, refetch } = useGymDbSessions();
  const endpoint = '/api';

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

  const timeEndForSession = (session: GymDbSession): string =>
    session.time_end ?? endFor(session.session_name) ?? session.time_start;

  const toDialogSession = (session: GymDbSession): GymSession => ({
    id: `gymdb-${session.session_name}-${session.time_start}`,
    session_name: session.session_name,
    time_start: session.time_start,
    time_end: timeEndForSession(session),
    quota: session.quota,
    created_at: '',
    updated_at: '',
  });

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
                      <TableHead className="text-right">Actions</TableHead>
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
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingSession(session);
                                setEditDialogOpen(true);
                              }}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setDeletingSession(session);
                                setDeleteDialogOpen(true);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center justify-center p-8 bg-card rounded-xl shadow-sm border max-w-md text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 mb-4">
                    <CalendarIcon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Belum ada jadwal gym</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Buat jadwal gym untuk mulai mengatur sesi dan kuota.
                  </p>
                  <Button onClick={() => setSessionDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Buat Jadwal Gym
                  </Button>
                </div>
              </div>
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

      <SessionDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingSession(null);
        }}
        session={editingSession ? toDialogSession(editingSession) : null}
        onSubmit={async (data) => {
          if (!editingSession) return;
          setIsSaving(true);
          try {
            const resp = await fetch(`${endpoint}/gym-session-update`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                original_session_name: editingSession.session_name,
                original_time_start: editingSession.time_start,
                session_name: data.session_name,
                time_start: data.time_start,
                time_end: data.time_end,
                quota: data.quota,
              }),
            });
            const json = await resp.json();
            if (!json?.ok) throw new Error(json?.error || 'Failed to update session');
            toast.success('Session updated');
            setEditDialogOpen(false);
            setEditingSession(null);
            refetch();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update session');
          } finally {
            setIsSaving(false);
          }
        }}
        isLoading={isSaving}
      />

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeletingSession(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deletingSession) return;
                setIsDeleting(true);
                try {
                  const resp = await fetch(`${endpoint}/gym-session-delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      session_name: deletingSession.session_name,
                      time_start: deletingSession.time_start,
                    }),
                  });
                  const json = await resp.json();
                  if (!json?.ok) throw new Error(json?.error || 'Failed to delete session');
                  toast.success('Session deleted');
                  setDeleteDialogOpen(false);
                  setDeletingSession(null);
                  refetch();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Failed to delete session');
                } finally {
                  setIsDeleting(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
