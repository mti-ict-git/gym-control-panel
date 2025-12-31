import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export interface GymUser {
  id: string;
  name: string;
  employee_id: string;
  vault_employee_id: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
}

export function useGymUsers(search: string = '', page: number = 1, pageSize: number = 10) {
  return useQuery({
    queryKey: ['gym-users', { search, page, pageSize }],
    queryFn: async () => {
      const q = search?.trim() || '';
      const resp = await fetch(`/api/employee-core${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      const json: { ok: boolean; employees?: Array<{ employee_id: string; name: string; department: string | null }>; error?: string } = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json.error || 'Failed to load employees');
      const employees = Array.isArray(json.employees) ? json.employees : [];
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const slice = employees.slice(start, end);
      const mapped: GymUser[] = slice.map((e) => ({
        id: e.employee_id,
        name: e.name,
        employee_id: e.employee_id,
        vault_employee_id: null,
        department: e.department,
        created_at: '',
        updated_at: '',
      }));
      return { data: mapped, total: employees.length };
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useGymUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['gym-user', userId],
    queryFn: async () => {
      if (!userId) return null;
      const resp = await fetch(`/api/employee-core?ids=${encodeURIComponent(userId)}`);
      const json: { ok: boolean; employees?: Array<{ employee_id: string; name: string; department: string | null }>; error?: string } = await resp.json();
      if (!resp.ok || !json.ok) throw new Error(json.error || 'Failed to load employee');
      const e = (json.employees || []).find((x) => x.employee_id === userId) || null;
      return e
        ? ({ id: e.employee_id, name: e.name, employee_id: e.employee_id, vault_employee_id: null, department: e.department, created_at: '', updated_at: '' } as GymUser)
        : null;
    },
    enabled: !!userId,
  });
}

export function useAddGymUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (_userData: { name: string; employee_id: string }) => {
      throw new Error('Add user is not supported; users are sourced from MasterDB');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-users'] });
      toast({
        title: "User Added",
        description: `${data.name} has been added successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useAddGymUserFromVault() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (_userData: { 
      vault_employee_id: string; 
      name: string; 
      department: string;
      employee_id: string;
    }) => {
      throw new Error('Add from Vault not supported; users come from MasterDB');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-users'] });
      toast({
        title: "Added to Gym Users",
        description: `${data.name} can now access the gym.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteGymUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (userId: string) => {
      throw new Error('Delete user is not supported');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-users'] });
      toast({
        title: "User Deleted",
        description: "Operation not supported.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
