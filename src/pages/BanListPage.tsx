import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';

interface BanRecord {
  employee_id: string;
  name: string | null;
  department: string | null;
  banned_until: string | null;
  status: string | null;
  reason: string | null;
  consecutive_no_show: number;
  updated_at: string | null;
  created_at: string | null;
}

interface BanListResponse {
  ok: boolean;
  bans?: BanRecord[];
  total?: number;
  active_total?: number;
  error?: string;
}

const parseDateOnly = (value: string | null | undefined) => {
  const s = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
};

const formatDateOnly = (value: string | null | undefined) => {
  const s = parseDateOnly(value);
  if (!s) return '-';
  const d = new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return s;
  return format(d, 'yyyy-MM-dd');
};

export default function BanListPage() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['gym-ban-list', query, scope],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (scope === 'all') params.set('include_expired', '1');
      const qs = params.toString();
      const tryFetch = async (base: string) => {
        const resp = await fetch(`${base}/gym-booking-ban-list${qs ? `?${qs}` : ''}`);
        const json = (await resp.json()) as BanListResponse;
        if (!json || !json.ok) throw new Error(json?.error || 'Failed to load ban list');
        return json;
      };
      try {
        return await tryFetch('/api');
      } catch (_) {
        return await tryFetch('');
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const bans = Array.isArray(data?.bans) ? data?.bans : [];
  const total = Number(data?.total || 0);
  const activeTotal = Number(data?.active_total || 0);

  const countdownFor = (value: string | null | undefined) => {
    const s = parseDateOnly(value);
    if (!s) return '-';
    const target = new Date(`${s}T23:59:59`);
    const diffMs = target.getTime() - now.getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return 'Expired';
    const totalMinutes = Math.ceil(diffMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const mins = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const statusBadge = (status: string | null | undefined) => {
    const s = String(status || '').toUpperCase();
    if (s === 'ACTIVE') {
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Expired</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ban List</h1>
            <p className="text-muted-foreground">Daftar user yang sedang kena ban</p>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <Input
              placeholder="Cari EmployeeID atau Nama"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="md:w-64"
            />
            <Select value={scope} onValueChange={(v) => setScope(v as 'active' | 'all')}>
              <SelectTrigger className="md:w-44">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active saja</SelectItem>
                <SelectItem value="all">Semua riwayat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Total Ban</CardTitle>
              <CardDescription>Jumlah data ban sesuai filter</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ban Aktif</CardTitle>
              <CardDescription>Jumlah user yang masih diban</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{activeTotal}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daftar Ban</CardTitle>
            <CardDescription>Data ban berdasarkan booking no-show</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : isError ? (
              <div className="text-sm text-rose-600">Gagal memuat data ban</div>
            ) : bans.length === 0 ? (
              <div className="text-sm text-muted-foreground">Tidak ada data ban</div>
            ) : (
              <div className="w-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>EmployeeID</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Banned Until</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Consecutive No-Show</TableHead>
                      <TableHead>Updated At</TableHead>
                      <TableHead>Countdown</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bans.map((row) => (
                      <TableRow key={`${row.employee_id}-${row.banned_until}`}>
                        <TableCell className="font-mono text-sm">{row.employee_id || '-'}</TableCell>
                        <TableCell className="text-sm">{row.name || '-'}</TableCell>
                        <TableCell className="text-sm">{row.department || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{formatDateOnly(row.banned_until)}</TableCell>
                        <TableCell>{statusBadge(row.status)}</TableCell>
                        <TableCell className="text-sm">{row.reason || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{Number(row.consecutive_no_show || 0)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.updated_at ? format(new Date(row.updated_at), 'yyyy-MM-dd HH:mm') : row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{countdownFor(row.banned_until)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
