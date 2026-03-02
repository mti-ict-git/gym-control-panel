import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Ban, Clock, Search, ShieldX } from 'lucide-react';

interface BanRecord {
  employee_id: string;
  name: string | null;
  department: string | null;
  banned_until: string | null;
  status: string | null;
  reason: string | null;
  unban_remark: string | null;
  action_by: string | null;
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
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [unbanOpen, setUnbanOpen] = useState(false);
  const [unbanEmployee, setUnbanEmployee] = useState<BanRecord | null>(null);
  const [unbanRemark, setUnbanRemark] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canUnbanByRole = user?.role === 'superadmin' || user?.role === 'committee';
  const isCommittee = user?.role === 'committee';

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, scope]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['gym-ban-list', query, scope, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (scope === 'all') params.set('include_expired', '1');
      params.set('page', String(page));
      params.set('limit', String(pageSize));
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

  const unbanMutation = useMutation({
    mutationFn: async ({ employeeId, remark }: { employeeId: string; remark: string }) => {
      const token = localStorage.getItem('auth_token') || '';
      const post = async (url: string) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ employee_id: employeeId, remark }),
        });
        const json = (await resp.json()) as { ok: boolean; error?: string };
        if (resp.status >= 500) throw new Error(json?.error || 'Server error');
        if (!json?.ok) throw new Error(json?.error || 'Failed to reset ban');
        return true;
      };
      try {
        return await post('/api/gym-booking-ban-reset');
      } catch (_) {
        return await post('/gym-booking-ban-reset');
      }
    },
    onSuccess: async () => {
      toast.success('Ban direset');
      setUnbanOpen(false);
      setUnbanEmployee(null);
      setUnbanRemark('');
      await queryClient.invalidateQueries({ queryKey: ['gym-ban-list'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Gagal reset ban');
    },
  });

  const bans = Array.isArray(data?.bans) ? data?.bans : [];
  const total = Number(data?.total || 0);
  const activeTotal = Number(data?.active_total || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = total === 0 ? 0 : Math.min(safePage * pageSize, total);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
        <Card className="border bg-gradient-to-b from-white to-slate-50/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                  <Ban className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle className="text-2xl">Ban List</CardTitle>
                  <CardDescription>Daftar user yang sedang kena ban</CardDescription>
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                <div className="relative md:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cari EmployeeID atau Nama"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={scope} onValueChange={(v) => setScope(v as 'active' | 'all')}>
                  <SelectTrigger className="md:w-48">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active saja</SelectItem>
                    <SelectItem value="all">Semua riwayat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-rose-200/60 bg-gradient-to-br from-rose-50 to-rose-100/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Total Ban</CardTitle>
                  <CardDescription>Jumlah data ban sesuai filter</CardDescription>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-rose-600 ring-1 ring-rose-200">
                  <ShieldX className="h-5 w-5" />
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{total}</div>
            </CardContent>
          </Card>
          <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-100/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ban Aktif</CardTitle>
                  <CardDescription>Jumlah user yang masih diban</CardDescription>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-amber-600 ring-1 ring-amber-200">
                  <Clock className="h-5 w-5" />
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{activeTotal}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Daftar Ban</CardTitle>
                <CardDescription>Data ban berdasarkan booking no-show</CardDescription>
              </div>
            </div>
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
                <Table className="text-xs md:text-sm">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="border-b bg-muted/30">
                      <TableHead className="whitespace-nowrap">EmployeeID</TableHead>
                      <TableHead className="whitespace-nowrap">Nama</TableHead>
                      <TableHead className="whitespace-nowrap">Department</TableHead>
                      <TableHead className="whitespace-nowrap">Banned Until</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Reason</TableHead>
                      <TableHead className="whitespace-nowrap">Unban Remark</TableHead>
                      {!isCommittee && <TableHead className="whitespace-nowrap">Action By</TableHead>}
                      <TableHead className="whitespace-nowrap">Consecutive No-Show</TableHead>
                      <TableHead className="whitespace-nowrap">Updated At</TableHead>
                      <TableHead className="whitespace-nowrap">Countdown</TableHead>
                      <TableHead className="whitespace-nowrap">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bans.map((row) => {
                      const status = String(row.status || '').toUpperCase();
                      const canUnban = status === 'ACTIVE' && canUnbanByRole;
                      const rowClass =
                        status === 'ACTIVE'
                          ? 'hover:bg-amber-50/60'
                          : 'hover:bg-slate-50';
                      return (
                        <TableRow key={`${row.employee_id}-${row.banned_until}`} className={rowClass}>
                          <TableCell className="whitespace-nowrap font-mono py-2">{row.employee_id || '-'}</TableCell>
                          <TableCell className="whitespace-nowrap py-2">{row.name || '-'}</TableCell>
                          <TableCell className="whitespace-nowrap py-2">{row.department || '-'}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono py-2">{formatDateOnly(row.banned_until)}</TableCell>
                          <TableCell className="whitespace-nowrap py-2">{statusBadge(row.status)}</TableCell>
                          <TableCell className="max-w-[280px] truncate py-2">{row.reason || '-'}</TableCell>
                          <TableCell className="max-w-[280px] truncate py-2">{row.unban_remark || '-'}</TableCell>
                          {!isCommittee && <TableCell className="max-w-[160px] truncate py-2">{row.action_by || '-'}</TableCell>}
                          <TableCell className="whitespace-nowrap font-mono py-2">
                            <span
                              className={
                                Number(row.consecutive_no_show || 0) >= 2
                                  ? 'inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-rose-700'
                                  : 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-slate-700'
                              }
                            >
                              {Number(row.consecutive_no_show || 0)}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono py-2">
                            {row.updated_at ? format(new Date(row.updated_at), 'yyyy-MM-dd HH:mm') : row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap py-2">
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs">
                              {countdownFor(row.banned_until)}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap py-2">
                            {canUnban ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setUnbanEmployee(row);
                                  setUnbanRemark('');
                                  setUnbanOpen(true);
                                }}
                                disabled={unbanMutation.isPending}
                                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                              >
                                Unban
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {!isLoading && !isError && total > 0 && (
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                  Menampilkan {startIndex}-{endIndex} dari {total}
                </div>
                <Pagination className="md:justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        className={safePage <= 1 ? 'pointer-events-none opacity-50' : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          if (safePage > 1) setPage(safePage - 1);
                        }}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink href="#" isActive onClick={(e) => e.preventDefault()}>
                        {safePage}
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        className={safePage >= totalPages ? 'pointer-events-none opacity-50' : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          if (safePage < totalPages) setPage(safePage + 1);
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog
        open={unbanOpen}
        onOpenChange={(open) => {
          setUnbanOpen(open);
          if (!open) {
            setUnbanEmployee(null);
            setUnbanRemark('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unban User</DialogTitle>
            <DialogDescription>
              {unbanEmployee ? `Employee ${unbanEmployee.employee_id}${unbanEmployee.name ? ` - ${unbanEmployee.name}` : ''}` : 'Pilih user untuk unban'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="unban-remark">Remark</Label>
            <Textarea
              id="unban-remark"
              value={unbanRemark}
              onChange={(e) => setUnbanRemark(e.target.value)}
              placeholder="Alasan unban"
              maxLength={255}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnbanOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!unbanEmployee) return;
                unbanMutation.mutate({ employeeId: unbanEmployee.employee_id, remark: unbanRemark.trim() });
              }}
              disabled={!unbanEmployee || unbanRemark.trim().length === 0 || unbanMutation.isPending}
            >
              {unbanMutation.isPending ? 'Saving...' : 'Unban'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
