import { useNavigate } from 'react-router-dom';
import { Users, Database } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGymUsers, GymUser } from '@/hooks/useGymUsers';
import { useMostRelevantSchedule } from '@/hooks/useGymSchedules';
import { StatusBadge } from '@/components/StatusBadge';

function UserRow({ user, onClick }: { user: GymUser; onClick: () => void }) {
  const { data: schedule } = useMostRelevantSchedule(user.id);
  
  return (
    <TableRow 
      className="row-interactive"
      onClick={onClick}
    >
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
  const { data: users, isLoading } = useGymUsers();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Live Gym Monitoring</h1>
          <p className="text-muted-foreground">Real-time overview of active gym members and access status.</p>
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
                  <TableHead>ID Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Status</TableHead>
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
