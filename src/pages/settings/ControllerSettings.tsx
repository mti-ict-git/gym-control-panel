import { Server } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export default function ControllerSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
  const [graceBeforeMin, setGraceBeforeMin] = useState(0);
  const [graceAfterMin, setGraceAfterMin] = useState(0);
  const [workerIntervalSec, setWorkerIntervalSec] = useState(60);

  const settingsQuery = useQuery({
    queryKey: ['gym-controller-settings'],
    queryFn: async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch controller settings');
        return (await resp.json()) as {
          ok: boolean;
          enable_auto_organize?: boolean;
          grace_before_min?: number;
          grace_after_min?: number;
          worker_interval_ms?: number;
          error?: string;
        };
      };

      try {
        const json = await tryFetch('/api/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch controller settings');
        return {
          enable_auto_organize: Boolean(json.enable_auto_organize),
          grace_before_min: Number(json.grace_before_min ?? 0) || 0,
          grace_after_min: Number(json.grace_after_min ?? 0) || 0,
          worker_interval_ms: Number(json.worker_interval_ms ?? 60000) || 60000,
        };
      } catch (_) {
        const json = await tryFetch('/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch controller settings');
        return {
          enable_auto_organize: Boolean(json.enable_auto_organize),
          grace_before_min: Number(json.grace_before_min ?? 0) || 0,
          grace_after_min: Number(json.grace_after_min ?? 0) || 0,
          worker_interval_ms: Number(json.worker_interval_ms ?? 60000) || 60000,
        };
      }
    },
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setEnabled(Boolean(settingsQuery.data.enable_auto_organize));
    setGraceBeforeMin(Number(settingsQuery.data.grace_before_min ?? 0) || 0);
    setGraceAfterMin(Number(settingsQuery.data.grace_after_min ?? 0) || 0);
    const ms = Number(settingsQuery.data.worker_interval_ms ?? 60000) || 60000;
    setWorkerIntervalSec(Math.max(5, Math.round(ms / 1000)));
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (input: {
      enable_auto_organize: boolean;
      grace_before_min: number;
      grace_after_min: number;
      worker_interval_ms: number;
    }) => {
      const post = async (url: string) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
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

  const isBusy = settingsQuery.isLoading || updateMutation.isPending;
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const safeGraceBeforeMin = clamp(Number(graceBeforeMin) || 0, 0, 1440);
  const safeGraceAfterMin = clamp(Number(graceAfterMin) || 0, 0, 1440);
  const safeWorkerIntervalSec = clamp(Number(workerIntervalSec) || 60, 5, 3600);
  const payload = {
    enable_auto_organize: Boolean(enabled),
    grace_before_min: safeGraceBeforeMin,
    grace_after_min: safeGraceAfterMin,
    worker_interval_ms: safeWorkerIntervalSec * 1000,
  };

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
              <div className="text-sm text-muted-foreground">Auto-adjust controller access timezone during booking range (with grace window).</div>
            </div>
            <Switch
              checked={enabled}
              disabled={isBusy}
              onCheckedChange={(next) => {
                setEnabled(next);
                updateMutation.mutate({ ...payload, enable_auto_organize: next });
              }}
            />
          </div>

          <div className="grid grid-cols-12 gap-4 rounded-lg border p-4">
            <div className="col-span-12 md:col-span-6 space-y-1">
              <div className="text-sm font-medium">Allow access before start (minutes)</div>
              <div className="text-sm text-muted-foreground">Extra minutes before session starts.</div>
              <Input
                type="number"
                min={0}
                max={1440}
                value={graceBeforeMin}
                disabled={isBusy}
                onChange={(e) => setGraceBeforeMin(Number(e.target.value))}
              />
            </div>

            <div className="col-span-12 md:col-span-6 space-y-1">
              <div className="text-sm font-medium">Revoke access after end (minutes)</div>
              <div className="text-sm text-muted-foreground">Extra minutes after session ends.</div>
              <Input
                type="number"
                min={0}
                max={1440}
                value={graceAfterMin}
                disabled={isBusy}
                onChange={(e) => setGraceAfterMin(Number(e.target.value))}
              />
            </div>

            <div className="col-span-12 md:col-span-6 space-y-1">
              <div className="text-sm font-medium">Worker interval (seconds)</div>
              <div className="text-sm text-muted-foreground">How often the auto-organize worker checks bookings.</div>
              <Input
                type="number"
                min={5}
                max={3600}
                value={workerIntervalSec}
                disabled={isBusy}
                onChange={(e) => setWorkerIntervalSec(Number(e.target.value))}
              />
            </div>

            <div className="col-span-12 flex justify-end">
              <Button
                disabled={isBusy}
                onClick={() => {
                  updateMutation.mutate(payload);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
