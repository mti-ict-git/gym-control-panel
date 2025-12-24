import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { gymUsers, getNextScheduleForUser, GymUser } from '@/data/mockData';

export default function GymUsersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<GymUser[]>(gymUsers);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newEmployeeId, setNewEmployeeId] = useState('');

  const handleAddUser = () => {
    if (!newUserName.trim() || !newEmployeeId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    const newUser: GymUser = {
      id: String(Date.now()),
      name: newUserName,
      employeeId: newEmployeeId,
      createdAt: new Date().toISOString(),
    };

    setUsers([...users, newUser]);
    setNewUserName('');
    setNewEmployeeId('');
    setIsDialogOpen(false);
    
    toast({
      title: "User Added",
      description: `${newUserName} has been added successfully.`,
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gym Users</h1>
          <p className="text-muted-foreground">Manage gym members and their schedules.</p>
        </div>

        {users.length > 0 ? (
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
                {users.map((user) => {
                  const nextSchedule = getNextScheduleForUser(user.id);
                  return (
                    <TableRow 
                      key={user.id} 
                      className="row-interactive"
                      onClick={() => navigate(`/users/${user.id}`)}
                    >
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.employeeId}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {nextSchedule ? (
                          format(new Date(nextSchedule.scheduleTime), 'MMM d, h:mm a')
                        ) : (
                          <span className="text-muted-foreground">No upcoming</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="No gym users yet"
            description="Add your first gym user to get started."
            action={
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            }
          />
        )}

        <FloatingActionButton onClick={() => setIsDialogOpen(true)} />

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Enter full name"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="touch-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  placeholder="Enter employee ID"
                  value={newEmployeeId}
                  onChange={(e) => setNewEmployeeId(e.target.value)}
                  className="touch-target"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUser}>Add User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
