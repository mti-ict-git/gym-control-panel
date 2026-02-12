import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export interface DatabaseConnection {
  id: string;
  display_name: string;
  database_type: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  password_encrypted: string;
  is_active: boolean;
  connection_status: string;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DatabaseConnectionInput {
  display_name: string;
  database_type: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  password_encrypted: string;
  is_active: boolean;
}

export function useDatabaseConnections() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: connections = [], isLoading, error } = useQuery({
    queryKey: ['database-connections'],
    queryFn: async () => {
      const resp = await fetch('/api/db-connections');
      if (!resp.ok) throw new Error('Failed to fetch database connections');
      const json: { ok: boolean; connections: DatabaseConnection[]; error?: string } = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to fetch database connections');
      return json.connections;
    },
  });

  const createConnection = useMutation({
    mutationFn: async (input: DatabaseConnectionInput) => {
      const resp = await fetch('/api/db-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!resp.ok) throw new Error('Failed to create database connection');
      const json: { ok: boolean; id?: string; error?: string } = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to create database connection');
      return json.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-connections'] });
      toast({
        title: 'Database Added',
        description: 'Database connection has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateConnection = useMutation({
    mutationFn: async ({ id, ...input }: Partial<DatabaseConnectionInput> & { id: string }) => {
      const resp = await fetch('/api/db-connections-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...input }),
      });
      if (!resp.ok) throw new Error('Failed to update database connection');
      const json: { ok: boolean; error?: string } = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to update database connection');
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-connections'] });
      toast({
        title: 'Database Updated',
        description: 'Database connection has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const resp = await fetch('/api/db-connections-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!resp.ok) throw new Error('Failed to delete database connection');
      const json: { ok: boolean; error?: string } = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to delete database connection');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['database-connections'] });
      toast({
        title: 'Database Deleted',
        description: 'Database connection has been deleted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const testConnection = useMutation({
    mutationFn: async (id: string) => {
      const resp = await fetch('/api/db-connections-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!resp.ok) throw new Error('Failed to test database connection');
      const json: { ok: boolean; success?: boolean; error?: string } = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to test database connection');
      return { success: Boolean(json.success) };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['database-connections'] });
      toast({
        title: result.success ? 'Connection Successful' : 'Connection Failed',
        description: result.success 
          ? 'Database connection test passed.' 
          : 'Could not connect to the database. Please check your settings.',
        variant: result.success ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleConnection = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const resp = await fetch('/api/db-connections-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active }),
      });
      if (!resp.ok) throw new Error('Failed to update database connection');
      const json: { ok: boolean; error?: string } = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to update database connection');
      const list = queryClient.getQueryData(['database-connections']) as DatabaseConnection[] | undefined;
      const found = Array.isArray(list) ? list.find((c) => c.id === id) : undefined;
      return { id, is_active, display_name: found ? found.display_name : '' };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['database-connections'] });
      toast({
        title: data.is_active ? 'Database Enabled' : 'Database Disabled',
        description: `${data.display_name} has been ${data.is_active ? 'enabled' : 'disabled'}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    connections,
    isLoading,
    error,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    toggleConnection,
  };
}

export function useDatabaseConnection(id: string | undefined) {
  return useQuery({
    queryKey: ['database-connection', id],
    queryFn: async () => {
      if (!id) return null;
      const resp = await fetch('/api/db-connections');
      if (!resp.ok) throw new Error('Failed to fetch database connections');
      const json: { ok: boolean; connections: DatabaseConnection[]; error?: string } = await resp.json();
      if (!json.ok) throw new Error(json.error || 'Failed to fetch database connections');
      const found = json.connections.find((c) => c.id === id) || null;
      return found;
    },
    enabled: !!id,
  });
}
