import { CalendarDays } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function DayAccessSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [allowSameDay, setAllowSameDay] = useState(false);
  const [maxDaysAhead, setMaxDaysAhead] = useState(2);

  const settingsQuery = useQuery({
    queryKey: ['gym-controller-settings'],
    queryFn: async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Failed to fetch day access settings');
        return (await resp.json()) as {
          ok: boolean;
          booking_min_days_ahead?: number;
          booking_max_days_ahead?: number;
          error?: string;
        };
      };

      try {
        const json = await tryFetch('/api/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch day access settings');
        return {
          booking_min_days_ahead: Number(json.booking_min_days_ahead ?? 1) || 1,
          booking_max_days_ahead: Number(json.booking_max_days_ahead ?? 2) || 2,
        };
      } catch (_) {
        const json = await tryFetch('/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to fetch day access settings');
        return {
          booking_min_days_ahead: Number(json.booking_min_days_ahead ?? 1) || 1,
          booking_max_days_ahead: Number(json.booking_max_days_ahead ?? 2) || 2,
        };
      }
    },
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    const min = Number(settingsQuery.data.booking_min_days_ahead ?? 1) || 1;
    const max = Number(settingsQuery.data.booking_max_days_ahead ?? 2) || 2;
    setAllowSameDay(min <= 0);
    setMaxDaysAhead(Math.max(0, max));
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (input: { booking_min_days_ahead: number; booking_max_days_ahead: number }) => {
      const post = async (url: string) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (!resp.ok) throw new Error('Failed to update day access settings');
        return (await resp.json()) as { ok: boolean; error?: string };
      };

      try {
        const json = await post('/api/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to update day access settings');
        return true;
      } catch (_) {
        const json = await post('/gym-controller-settings');
        if (!json.ok) throw new Error(json.error || 'Failed to update day access settings');
        return true;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gym-controller-settings'] });
      toast({ title: 'Saved', description: 'Day access settings updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const isBusy = settingsQuery.isLoading || updateMutation.isPending;
  const minDays = allowSameDay ? 0 : 1;
  const maxDays = Math.max(minDays, Math.min(30, Number(maxDaysAhead) || 0));
  const payload = { booking_min_days_ahead: minDays, booking_max_days_ahead: maxDays };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Day Access</h1>
        <p className="text-muted-foreground">Configure allowed booking dates relative to today.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Booking Window</CardTitle>
          </div>
          <CardDescription>Control which dates users can book.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Allow same-day booking</div>
              <div className="text-sm text-muted-foreground">If enabled, users can book for today.</div>
            </div>
            <Switch
              checked={allowSameDay}
              disabled={isBusy}
              onCheckedChange={(next) => {
                setAllowSameDay(next);
                const nextMin = next ? 0 : 1;
                updateMutation.mutate({ booking_min_days_ahead: nextMin, booking_max_days_ahead: Math.max(nextMin, maxDays) });
              }}
            />
          </div>

          <div className="grid grid-cols-12 gap-4 rounded-lg border p-4">
            <div className="col-span-12 md:col-span-6 space-y-1">
              <div className="text-sm font-medium">Max days ahead allowed</div>
              <div className="text-sm text-muted-foreground">Upper bound from today (0–30).</div>
              <Input
                type="number"
                min={minDays}
                max={30}
                value={maxDaysAhead}
                disabled={isBusy}
                onChange={(e) => setMaxDaysAhead(Number(e.target.value))}
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
