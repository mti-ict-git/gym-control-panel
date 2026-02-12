import { KeyRound, Plus, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AccessPermissionSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [managerAllSessionAccess, setManagerAllSessionAccess] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const settingsQuery = useQuery({
    queryKey: ['gym-controller-settings'],
    queryFn: async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch controller settings');
        return (await resp.json()) as {
          ok: boolean;
          enable_manager_all_session_access?: boolean;
          error?: string;
        };
      };

      try {
        const json = await tryFetch('/api/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch controller settings');
        return { enable_manager_all_session_access: Boolean(json.enable_manager_all_session_access) };
      } catch (_) {
        const json = await tryFetch('/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch controller settings');
        return { enable_manager_all_session_access: Boolean(json.enable_manager_all_session_access) };
      }
    },
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setManagerAllSessionAccess(Boolean(settingsQuery.data.enable_manager_all_session_access));
  }, [settingsQuery.data]);

  const updateManagerMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const post = async (url: string) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enable_manager_all_session_access: enabled }),
        });
        if (!resp.ok) throw new Error('Failed to update access permission settings');
        return (await resp.json()) as { ok: boolean; error?: string };
      };

      try {
        const json = await post('/api/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to update access permission settings');
        return true;
      } catch (_) {
        const json = await post('/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to update access permission settings');
        return true;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gym-controller-settings'] });
      toast({ title: 'Saved', description: 'Access permission settings updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const committeeQuery = useQuery({
    queryKey: ['gym-access-committee'],
    queryFn: async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch committee list');
        return (await resp.json()) as {
          ok: boolean;
          members?: Array<{ employee_id: string; unit_no: string; created_at: string | null; updated_at: string | null }>;
          error?: string;
        };
      };

      try {
        const json = await tryFetch('/api/gym-access-committee');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch committee list');
        return Array.isArray(json.members) ? json.members : [];
      } catch (_) {
        const json = await tryFetch('/gym-access-committee');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch committee list');
        return Array.isArray(json.members) ? json.members : [];
      }
    },
  });

  const committeeIds = useMemo(
    () => (Array.isArray(committeeQuery.data) ? committeeQuery.data.map((m) => m.employee_id).filter(Boolean) : []),
    [committeeQuery.data]
  );

  const committeeDetailsQuery = useQuery({
    queryKey: ['employee-core', { ids: committeeIds.join(',') }],
    enabled: committeeIds.length > 0,
    queryFn: async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch employee details');
        return (await resp.json()) as {
          ok: boolean;
          employees?: Array<{ employee_id: string; name: string; department: string | null }>;
          error?: string;
        };
      };

      const ids = committeeIds.join(',');
      try {
        const json = await tryFetch(`/api/employee-core?ids=${encodeURIComponent(ids)}&limit=200`);
        if (!json.ok) throw new Error(json.error || 'Failed to fetch employee details');
        return Array.isArray(json.employees) ? json.employees : [];
      } catch (_) {
        const json = await tryFetch(`/employee-core?ids=${encodeURIComponent(ids)}&limit=200`);
        if (!json.ok) throw new Error(json.error || 'Failed to fetch employee details');
        return Array.isArray(json.employees) ? json.employees : [];
      }
    },
  });

  const committeeInfoMap = useMemo(() => {
    const map = new Map<string, { name: string; department: string | null }>();
    const rows = Array.isArray(committeeDetailsQuery.data) ? committeeDetailsQuery.data : [];
    for (const r of rows) {
      map.set(String(r.employee_id), { name: String(r.name || '').trim(), department: r.department ?? null });
    }
    return map;
  }, [committeeDetailsQuery.data]);

  const employeeSearchQuery = useQuery({
    queryKey: ['employee-core-search', debouncedSearch],
    enabled: debouncedSearch.length > 0,
    queryFn: async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to search employees');
        return (await resp.json()) as {
          ok: boolean;
          employees?: Array<{ employee_id: string; name: string; department: string | null }>;
          error?: string;
        };
      };

      const q = debouncedSearch;
      try {
        const json = await tryFetch(`/api/employee-core?q=${encodeURIComponent(q)}&limit=20`);
        if (!json.ok) throw new Error(json.error || 'Failed to search employees');
        return Array.isArray(json.employees) ? json.employees : [];
      } catch (_) {
        const json = await tryFetch(`/employee-core?q=${encodeURIComponent(q)}&limit=20`);
        if (!json.ok) throw new Error(json.error || 'Failed to search employees');
        return Array.isArray(json.employees) ? json.employees : [];
      }
    },
  });

  const addCommitteeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const post = async (url: string) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: employeeId }),
        });
        if (!resp.ok) throw new Error('Failed to add committee member');
        return (await resp.json()) as { ok: boolean; error?: string };
      };

      try {
        const json = await post('/api/gym-access-committee-add');
        if (!json.ok) throw new Error(json.error || 'Failed to add committee member');
        return true;
      } catch (_) {
        const json = await post('/gym-access-committee-add');
        if (!json.ok) throw new Error(json.error || 'Failed to add committee member');
        return true;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gym-access-committee'] });
      toast({ title: 'Saved', description: 'Committee member added.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeCommitteeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const post = async (url: string) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: employeeId }),
        });
        if (!resp.ok) throw new Error('Failed to remove committee member');
        return (await resp.json()) as { ok: boolean; error?: string };
      };

      try {
        const json = await post('/api/gym-access-committee-remove');
        if (!json.ok) throw new Error(json.error || 'Failed to remove committee member');
        return true;
      } catch (_) {
        const json = await post('/gym-access-committee-remove');
        if (!json.ok) throw new Error(json.error || 'Failed to remove committee member');
        return true;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gym-access-committee'] });
      toast({ title: 'Saved', description: 'Committee member removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const bulkCommitteeAccessMutation = useMutation({
    mutationFn: async (allow: boolean) => {
      const postOne = async (url: string, employeeId: string) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: employeeId, access: allow, source: 'MANUAL_LOCK' }),
        });
        const json = (await resp.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (resp.status >= 500) throw new Error(json?.error || 'Server error');
        return json as { ok: boolean; error?: string };
      };

      const updateOne = async (employeeId: string) => {
        let json: { ok: boolean; error?: string } = { ok: false };
        try {
          json = await postOne('/api/gym-controller-access', employeeId);
        } catch (_) {
          json = await postOne('/gym-controller-access', employeeId);
        }
        if (!json?.ok) throw new Error(json?.error || 'Failed to update controller access');
        return true;
      };

      const ids = [...committeeIds];
      const failures: string[] = [];
      for (const id of ids) {
        try {
          await updateOne(id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          failures.push(`${id}: ${msg}`);
        }
      }

      if (failures.length > 0) {
        const preview = failures.slice(0, 3).join(' | ');
        const more = failures.length > 3 ? ` (+${failures.length - 3} more)` : '';
        throw new Error(`Updated ${ids.length - failures.length}/${ids.length}. ${failures.length} failed. ${preview}${more}`);
      }
      return true;
    },
    onSuccess: async (_data, allow) => {
      toast({
        title: 'Saved',
        description: allow ? 'Committee access applied.' : 'Committee access discarded.',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const isBusy =
    settingsQuery.isLoading ||
    updateManagerMutation.isPending ||
    committeeQuery.isLoading ||
    addCommitteeMutation.isPending ||
    removeCommitteeMutation.isPending ||
    bulkCommitteeAccessMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Access Permission</h1>
        <p className="text-muted-foreground">Configure access permission rules and mapping</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Access Permission</CardTitle>
          </div>
          <CardDescription>Manage access permission behavior for gym entry/exit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Enable Manager Up All Session Access</div>
              <div className="text-sm text-muted-foreground">Manager, GM, Sr Manager get all-session access.</div>
            </div>
            <Switch
              checked={managerAllSessionAccess}
              disabled={isBusy}
              onCheckedChange={(next) => {
                setManagerAllSessionAccess(next);
                updateManagerMutation.mutate(next);
              }}
            />
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Committee 24x7 access</div>
              <div className="text-sm text-muted-foreground">Add employees to always allow access.</div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
              <Button disabled={isBusy || committeeIds.length === 0} onClick={() => bulkCommitteeAccessMutation.mutate(true)}>
                Apply
              </Button>
              <Button
                variant="outline"
                disabled={isBusy || committeeIds.length === 0}
                onClick={() => bulkCommitteeAccessMutation.mutate(false)}
              >
                Discard
              </Button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  disabled={isBusy}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by employee ID or name"
                  className="pl-9"
                />
              </div>
              <div className="text-sm text-muted-foreground">{debouncedSearch ? 'Results update automatically.' : ''}</div>
            </div>

            {debouncedSearch && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Department</TableHead>
                      <TableHead className="w-20 text-right">Add</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(Array.isArray(employeeSearchQuery.data) ? employeeSearchQuery.data : []).map((e) => {
                      const already = committeeIds.includes(e.employee_id);
                      return (
                        <TableRow key={e.employee_id}>
                          <TableCell className="font-mono">{e.employee_id}</TableCell>
                          <TableCell className="font-medium">{e.name}</TableCell>
                          <TableCell className="hidden md:table-cell">{e.department ?? '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant={already ? 'secondary' : 'default'}
                              disabled={isBusy || already}
                              onClick={() => addCommitteeMutation.mutate(e.employee_id)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {employeeSearchQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-sm text-muted-foreground">
                          Searching...
                        </TableCell>
                      </TableRow>
                    )}
                    {!employeeSearchQuery.isLoading &&
                      (Array.isArray(employeeSearchQuery.data) ? employeeSearchQuery.data : []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground">
                            No results.
                          </TableCell>
                        </TableRow>
                      )}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Department</TableHead>
                    <TableHead className="w-20 text-right">Remove</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {committeeIds.map((employeeId) => {
                    const info = committeeInfoMap.get(employeeId) || { name: '-', department: null };
                    return (
                      <TableRow key={employeeId}>
                        <TableCell className="font-mono">{employeeId}</TableCell>
                        <TableCell className="font-medium">{info.name || '-'}</TableCell>
                        <TableCell className="hidden md:table-cell">{info.department ?? '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isBusy}
                            onClick={() => removeCommitteeMutation.mutate(employeeId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {committeeIds.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-sm text-muted-foreground">
                        No committee members yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
