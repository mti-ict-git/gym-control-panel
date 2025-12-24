import { useNavigate } from 'react-router-dom';
import { Users, Database } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGymUsers } from '@/hooks/useGymUsers';
import { useNextScheduleForUser } from '@/hooks/useGymSchedules';

function UserRow({ user, onClick }: { user: { id: string; name: string; employee_id: string }; onClick: () => void }) {
  const { data: nextSchedule } = useNextScheduleForUser(user.id);
  
  return (
    <TableRow 
      className="row-interactive"
      onClick={onClick}
    >
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell>{user.employee_id}</TableCell>
      <TableCell className="hidden md:table-cell">
        {nextSchedule ? (
          format(new Date(nextSchedule.schedule_time), 'MMM d, h:mm a')
        ) : (
          <span className="text-muted-foreground">No upcoming</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function GymUsersPage() {
  const navigate = useNavigate();
  const { data: users, isLoading } = useGymUsers();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gym Users</h1>
          <p className="text-muted-foreground">Members with gym access from Vault.</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : users && users.length > 0 ? (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead className="hidden md:table-cell">Next Schedule</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <UserRow 
                    key={user.id} 
                    user={user}
                    onClick={() => navigate(`/users/${user.id}`)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No gym users yet"
            description="Add employees from Vault to enable gym access."
            action={
              <Button onClick={() => navigate('/vault')}>
                <Database className="h-4 w-4 mr-2" />
                Go to Vault
              </Button>
            }
          />
        )}
      </div>
    </AppLayout>
  );
}
