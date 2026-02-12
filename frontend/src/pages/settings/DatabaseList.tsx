import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  RefreshCw,
  CheckCircle,
  XCircle,
  MinusCircle,
  Server
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useDatabaseConnections } from '@/hooks/useDatabaseConnections';

const DATABASE_TYPE_LABELS: Record<string, string> = {
  sqlserver: 'SQL Server',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  oracle: 'Oracle',
};

function getStatusBadge(status: string, isActive: boolean) {
  if (!isActive) {
    return (
      <Badge variant="outline" className="text-muted-foreground border-muted-foreground">
        <MinusCircle className="h-3 w-3 mr-1" />
        Disabled
      </Badge>
    );
  }

  switch (status) {
    case 'connected':
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="outline" className="text-destructive border-destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          <MinusCircle className="h-3 w-3 mr-1" />
          Not Tested
        </Badge>
      );
  }
}

export default function DatabaseList() {
  const navigate = useNavigate();
  const { 
    connections, 
    isLoading, 
    deleteConnection, 
    testConnection, 
    toggleConnection 
  } = useDatabaseConnections();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setSelectedId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedId) {
      await deleteConnection.mutateAsync(selectedId);
      setDeleteDialogOpen(false);
      setSelectedId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    await testConnection.mutateAsync(id);
    setTestingId(null);
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    await toggleConnection.mutateAsync({ id, is_active: !currentStatus });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Database Management</h1>
          <p className="text-muted-foreground">
            Manage external database connections
          </p>
        </div>
        <Button onClick={() => navigate('/settings/config/database/add')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Database
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Database Connections</CardTitle>
          </div>
          <CardDescription>
            {connections.length} database connection{connections.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Server className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No databases configured</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Add your first database connection to start managing external data sources.
              </p>
              <Button onClick={() => navigate('/settings/config/database/add')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Database
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Database</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.map((conn) => (
                    <TableRow key={conn.id}>
                      <TableCell className="font-medium">
                        {conn.display_name}
                      </TableCell>
                      <TableCell>
                        {DATABASE_TYPE_LABELS[conn.database_type] || conn.database_type}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {conn.host}:{conn.port}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {conn.database_name}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(conn.connection_status, conn.is_active)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`/settings/config/database/${conn.id}`)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleTest(conn.id)}
                              disabled={testingId === conn.id}
                            >
                              <RefreshCw className={`h-4 w-4 mr-2 ${testingId === conn.id ? 'animate-spin' : ''}`} />
                              {testingId === conn.id ? 'Testing...' : 'Test Connection'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggle(conn.id, conn.is_active)}
                            >
                              {conn.is_active ? (
                                <>
                                  <MinusCircle className="h-4 w-4 mr-2" />
                                  Disable
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Enable
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(conn.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Database Connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the 
              database connection configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
