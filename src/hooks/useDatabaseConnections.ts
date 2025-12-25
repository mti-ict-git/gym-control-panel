import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      const { data, error } = await supabase
        .from('database_connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DatabaseConnection[];
    },
  });

  const createConnection = useMutation({
    mutationFn: async (input: DatabaseConnectionInput) => {
      const { data, error } = await supabase
        .from('database_connections')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
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
      const { data, error } = await supabase
        .from('database_connections')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
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
      const { error } = await supabase
        .from('database_connections')
        .delete()
        .eq('id', id);

      if (error) throw error;
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
      // Simulate connection test - in real implementation, this would call an edge function
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const success = Math.random() > 0.3; // 70% success rate for demo
      
      const { error } = await supabase
        .from('database_connections')
        .update({
          connection_status: success ? 'connected' : 'error',
          last_tested_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      
      return { success };
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
      const { data, error } = await supabase
        .from('database_connections')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
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
      
      const { data, error } = await supabase
        .from('database_connections')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as DatabaseConnection | null;
    },
    enabled: !!id,
  });
}
