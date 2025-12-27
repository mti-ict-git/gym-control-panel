import { useState } from 'react';
import { Calendar as CalendarIcon, Plus, Pencil, Trash2, List } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useGymSessionsList, useCreateGymSession, useUpdateGymSession, useDeleteGymSession, GymSession, GymSessionInsert, formatTime } from '@/hooks/useGymSessions';
import { SessionDialog } from '@/components/schedules/SessionDialog';
import { WeeklyCalendar } from '@/components/schedules/WeeklyCalendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export default function SchedulesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<GymSession | null>(null);
  const [deleteSession, setDeleteSession] = useState<GymSession | null>(null);

  const { data: sessions, isLoading } = useGymSessionsList();
  const createMutation = useCreateGymSession();
  const updateMutation = useUpdateGymSession();
  const deleteMutation = useDeleteGymSession();

  const handleCreate = () => {
    setEditingSession(null);
    setDialogOpen(true);
  };

  const handleEdit = (session: GymSession) => {
    setEditingSession(session);
    setDialogOpen(true);
  };

  const handleSubmit = (data: GymSessionInsert) => {
    if (editingSession) {
      updateMutation.mutate(
        { id: editingSession.id, ...data },
        {
          onSuccess: () => {
            toast.success('Session updated');
            setDialogOpen(false);
          },
          onError: () => toast.error('Failed to update session'),
        }
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success('Session created');
          setDialogOpen(false);
        },
        onError: () => toast.error('Failed to create session'),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteSession) return;
    deleteMutation.mutate(deleteSession.id, {
      onSuccess: () => {
        toast.success('Session deleted');
        setDeleteSession(null);
      },
      onError: () => toast.error('Failed to delete session'),
    });
  };

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
              <Button onClick={handleCreate}>
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
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="font-medium">{session.session_name}</TableCell>
                        <TableCell>{formatTime(session.time_start)}</TableCell>
                        <TableCell>{formatTime(session.time_end)}</TableCell>
                        <TableCell>{session.quota}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(session)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteSession(session)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                icon={CalendarIcon}
                title="No sessions found"
                description="Create your first gym session to get started."
                action={
                  <Button onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Session
                  </Button>
                }
              />
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <WeeklyCalendar 
              sessions={sessions || []} 
              onCreateSession={handleCreate}
            />
          </TabsContent>
        </Tabs>
      </div>

      <SessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        session={editingSession}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!deleteSession} onOpenChange={() => setDeleteSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteSession?.session_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
