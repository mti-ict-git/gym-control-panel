import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Database, RefreshCw, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useDatabaseConnections, useDatabaseConnection } from '@/hooks/useDatabaseConnections';
import { useToast } from '@/hooks/use-toast';

const DATABASE_TYPES = [
  { value: 'sqlserver', label: 'Microsoft SQL Server', defaultPort: 1433 },
  { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'oracle', label: 'Oracle', defaultPort: 1521 },
];

interface FormData {
  display_name: string;
  database_type: string;
  host: string;
  port: string;
  database_name: string;
  username: string;
  password_encrypted: string;
  is_active: boolean;
}

export default function DatabaseForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const isEditing = !!id;
  
  const { createConnection, updateConnection, deleteConnection, testConnection } = useDatabaseConnections();
  const { data: existingConnection, isLoading: isLoadingConnection } = useDatabaseConnection(id);

  const [formData, setFormData] = useState<FormData>({
    display_name: '',
    database_type: 'sqlserver',
    host: '',
    port: '1433',
    database_name: '',
    username: '',
    password_encrypted: '',
    is_active: true,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (existingConnection) {
      setFormData({
        display_name: existingConnection.display_name,
        database_type: existingConnection.database_type,
        host: existingConnection.host,
        port: String(existingConnection.port),
        database_name: existingConnection.database_name,
        username: existingConnection.username,
        password_encrypted: existingConnection.password_encrypted,
        is_active: existingConnection.is_active,
      });
    }
  }, [existingConnection]);

  const handleDatabaseTypeChange = (type: string) => {
    const dbType = DATABASE_TYPES.find(t => t.value === type);
    setFormData({
      ...formData,
      database_type: type,
      port: String(dbType?.defaultPort || 1433),
    });
  };

  const validateForm = (): boolean => {
    if (!formData.display_name.trim()) {
      toast({ title: 'Validation Error', description: 'Display name is required.', variant: 'destructive' });
      return false;
    }
    if (!formData.host.trim()) {
      toast({ title: 'Validation Error', description: 'Host is required.', variant: 'destructive' });
      return false;
    }
    if (!formData.database_name.trim()) {
      toast({ title: 'Validation Error', description: 'Database name is required.', variant: 'destructive' });
      return false;
    }
    if (!formData.username.trim()) {
      toast({ title: 'Validation Error', description: 'Username is required.', variant: 'destructive' });
      return false;
    }
    if (!formData.password_encrypted.trim()) {
      toast({ title: 'Validation Error', description: 'Password is required.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        port: parseInt(formData.port, 10),
      };

      if (isEditing && id) {
        await updateConnection.mutateAsync({ id, ...payload });
      } else {
        await createConnection.mutateAsync(payload);
      }
      
      navigate('/settings/config/database');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!validateForm()) return;
    
    setIsTesting(true);
    // For new connections, we can't test without saving first
    if (!isEditing) {
      toast({
        title: 'Save First',
        description: 'Please save the connection before testing.',
        variant: 'destructive',
      });
      setIsTesting(false);
      return;
    }
    
    if (id) {
      await testConnection.mutateAsync(id);
    }
    setIsTesting(false);
  };

  const handleDelete = async () => {
    if (id) {
      await deleteConnection.mutateAsync(id);
      navigate('/settings/config/database');
    }
    setDeleteDialogOpen(false);
  };

  if (isEditing && isLoadingConnection) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings/config/database')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Edit Database' : 'Add Database'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing 
              ? 'Update database connection settings' 
              : 'Configure a new database connection'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Connection Details</CardTitle>
            </div>
            <CardDescription>
              Enter the database connection information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="display_name">Display Name *</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Production Database"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="database_type">Database Type</Label>
                <Select
                  value={formData.database_type}
                  onValueChange={handleDatabaseTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select database type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATABASE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="host">Host / IP Address *</Label>
                <Input
                  id="host"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="10.60.10.47"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  placeholder="1433"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="database_name">Database Name *</Label>
                <Input
                  id="database_name"
                  value={formData.database_name}
                  onChange={(e) => setFormData({ ...formData, database_name: e.target.value })}
                  placeholder="GymDB"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="db_user"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password_encrypted}
                  onChange={(e) => setFormData({ ...formData, password_encrypted: e.target.value })}
                  placeholder="Enter password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">
                  Enable or disable this database connection
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Database'}
              </Button>
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTesting}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/settings/config/database')}
              >
                Cancel
              </Button>
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="ml-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </form>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Database Connection?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the 
              database connection "{formData.display_name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
