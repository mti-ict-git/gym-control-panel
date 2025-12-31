import { Server } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function ControllerSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const settingsQuery = useQuery({
    queryKey: ['gym-controller-settings'],
    queryFn: async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch controller settings');
        return (await resp.json()) as { ok: boolean; enable_auto_organize?: boolean; error?: string };
      };

      try {
        const json = await tryFetch('/api/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch controller settings');
        return { enable_auto_organize: Boolean(json.enable_auto_organize) };
      } catch (_) {
        const json = await tryFetch('/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch controller settings');
        return { enable_auto_organize: Boolean(json.enable_auto_organize) };
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (enable_auto_organize: boolean) => {
      const post = async (url: string) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enable_auto_organize }),
        });
        if (!resp.ok) throw new Error('Failed to update controller settings');
        return (await resp.json()) as { ok: boolean; error?: string };
      };

      try {
        const json = await post('/api/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to update controller settings');
        return true;
      } catch (_) {
        const json = await post('/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to update controller settings');
        return true;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gym-controller-settings'] });
      toast({
        title: 'Saved',
        description: 'Controller settings updated.',
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

  const enabled = settingsQuery.data?.enable_auto_organize ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Controller</h1>
        <p className="text-muted-foreground">Configure controller settings</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Controller Settings</CardTitle>
          </div>
          <CardDescription>Manage controller identifiers and connectivity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Enable auto organize attendance access</div>
              <div className="text-sm text-muted-foreground">Auto-adjust controller access timezone during booking range.</div>
            </div>
            <Switch
              checked={enabled}
              disabled={settingsQuery.isLoading || updateMutation.isPending}
              onCheckedChange={(next) => updateMutation.mutate(next)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
