import { Database, UserPlus, AlertCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useVaultUsers, VaultUser } from '@/hooks/useVaultUsers';
import { useGymUsers, useAddGymUserFromVault } from '@/hooks/useGymUsers';

function VaultUserRow({ 
  user, 
  isAdded, 
  onAdd,
  isAdding 
}: { 
  user: VaultUser; 
  isAdded: boolean;
  onAdd: () => void;
  isAdding: boolean;
}) {
  const isInactive = user.status === 'INACTIVE';
  const isDisabled = isAdded || isInactive || isAdding;
  
  return (
    <TableRow>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell>{user.employee_id}</TableCell>
      <TableCell className="hidden md:table-cell">{user.department}</TableCell>
      <TableCell>
        <Badge variant={user.status === 'ACTIVE' ? 'default' : 'secondary'}>
          {user.status}
        </Badge>
      </TableCell>
      <TableCell>
        {isAdded ? (
          <Badge variant="outline" className="text-muted-foreground">
            Already Added
          </Badge>
        ) : isInactive ? (
          <Badge variant="outline" className="text-muted-foreground">
            Inactive
          </Badge>
        ) : (
          <Button 
            size="sm" 
            onClick={onAdd}
            disabled={isDisabled}
            className="touch-target"
          >
            <UserPlus className="h-4 w-4 mr-1" />
            {isAdding ? 'Adding...' : 'Add to Gym'}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function VaultPage() {
  const { toast } = useToast();
  const { data: vaultUsers, isLoading: isLoadingVault, error: vaultError } = useVaultUsers();
  const { data: gymUsers, isLoading: isLoadingGym } = useGymUsers();
  const addFromVaultMutation = useAddGymUserFromVault();

  const gymUserEmployeeIds = new Set(
    gymUsers?.map(u => u.vault_employee_id).filter(Boolean) || []
  );

  const handleAddToGym = (user: VaultUser) => {
    addFromVaultMutation.mutate({
      vault_employee_id: user.employee_id,
      name: user.name,
      department: user.department,
      employee_id: user.employee_id,
    });
  };

  const isLoading = isLoadingVault || isLoadingGym;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Vault
          </h1>
          <p className="text-muted-foreground">
            Employee data from Vault system. Add employees to enable gym access.
          </p>
        </div>

        {vaultError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>
              Unable to connect to Vault API. Please check the connection and try again.
            </AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : vaultUsers && vaultUsers.length > 0 ? (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vaultUsers.map((user) => (
                  <VaultUserRow
                    key={user.employee_id}
                    user={user}
                    isAdded={gymUserEmployeeIds.has(user.employee_id)}
                    onAdd={() => handleAddToGym(user)}
                    isAdding={addFromVaultMutation.isPending}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Vault Users</AlertTitle>
            <AlertDescription>
              No employee data available from Vault.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}
