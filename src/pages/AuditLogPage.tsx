import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollText, Search, RotateCcw } from 'lucide-react';
import { authHeaders, assertAuthorized } from '@/lib/utils';

interface AuditRow {
  id: number;
  created_at: string;
  actor_account_id: number | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  result: 'OK' | 'FAIL' | string;
  details: Record<string, unknown> | null;
  ip: string | null;
}

interface AuditResponse {
  ok: boolean;
  total?: number;
  actions?: string[];
  rows?: AuditRow[];
  error?: string;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  LOGIN_FAILED: 'Login gagal',
  PASSWORD_CHANGE: 'Ganti password',
  ACCESS_DENIED: 'Akses ditolak',
  ACCOUNT_CREATE: 'Buat akun',
  ACCOUNT_UPDATE: 'Ubah akun',
  ACCOUNT_DELETE: 'Hapus akun',
  ACCOUNTS_INIT: 'Init tabel akun',
  SESSION_CREATE: 'Buat sesi',
  SESSION_UPDATE: 'Ubah sesi',
  SESSION_DELETE: 'Hapus sesi',
  BOOKING_APPROVAL: 'Approve / reject booking',
  BOOKING_STATUS: 'Ubah status booking',
  BOOKING_DELETE: 'Hapus booking',
  DOOR_ACCESS_GRANT: 'Buka akses pintu',
  DOOR_ACCESS_REVOKE: 'Cabut akses pintu',
  COMMITTEE_ADD: 'Tambah committee',
  COMMITTEE_REMOVE: 'Hapus committee',
  ROSTER_ASSIGN: 'Jadwal committee',
  ROSTER_REMOVE: 'Hapus jadwal committee',
  CONTROLLER_SETTINGS_UPDATE: 'Ubah setting controller',
  SUPPORT_CONTACT_UPDATE: 'Ubah kontak support',
  BAN_RESET: 'Unban',
  BAN_APPLIED: 'Ban otomatis',
  BAN_SCAN: 'Scan ban otomatis',
};

const ROLE_LABELS: Record<string, string> = {
  kingadmin: 'King Admin',
  superadmin: 'Super Admin',
  admin: 'Admin',
  committee: 'Committee',
  system: 'System',
};

const actionLabel = (a: string) => ACTION_LABELS[a] || a;

// Stored in UTC; the gym runs on WITA.
const witaFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Makassar',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
const formatWita = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : witaFormatter.format(d);
};

const summarizeDetails = (details: Record<string, unknown> | null) => {
  if (!details) return '';
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
};

export default function AuditLogPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState('all');
  const [result, setResult] = useState('all');
  const [actor, setActor] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [openRow, setOpenRow] = useState<AuditRow | null>(null);
  const limit = 50;

  useEffect(() => {
    setPage(1);
  }, [from, to, action, result, actor, q]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['gym-audit-log', from, to, action, result, actor, q, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (action !== 'all') params.set('action', action);
      if (result !== 'all') params.set('result', result);
      if (actor.trim()) params.set('actor', actor.trim());
      if (q.trim()) params.set('q', q.trim());
      params.set('page', String(page));
      params.set('limit', String(limit));
      const resp = await fetch(`/api/gym-audit-log?${params.toString()}`, { headers: authHeaders() });
      assertAuthorized(resp);
      const json = (await resp.json()) as AuditResponse;
      if (!json?.ok) throw new Error(json?.error || 'Gagal memuat audit log');
      return json;
    },
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const rows = data?.rows || [];
  const total = Number(data?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const actions = data?.actions || [];

  const resetFilters = () => {
    setFrom('');
    setTo('');
    setAction('all');
    setResult('all');
    setActor('');
    setQ('');
  };

  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-56px)] bg-white -m-4 md:-m-6 p-4 md:p-6">
        <div className="space-y-6">
          <Card className="border bg-gradient-to-b from-white to-slate-50/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <ScrollText className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle className="text-2xl">Audit Log</CardTitle>
                  <CardDescription>
                    Siapa melakukan apa di panel, kapan, dan dari mana. Hanya bisa dilihat King Admin.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Dari tanggal" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Sampai tanggal" />
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger aria-label="Aksi">
                    <SelectValue placeholder="Semua aksi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua aksi</SelectItem>
                    {actions.map((a) => (
                      <SelectItem key={a} value={a}>
                        {actionLabel(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={result} onValueChange={setResult}>
                  <SelectTrigger aria-label="Hasil">
                    <SelectValue placeholder="Semua hasil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua hasil</SelectItem>
                    <SelectItem value="OK">Berhasil</SelectItem>
                    <SelectItem value="FAIL">Gagal</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Pelaku" value={actor} onChange={(e) => setActor(e.target.value)} />
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cari target / detail"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-muted-foreground">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset filter
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Riwayat Aktivitas</CardTitle>
              <CardDescription>
                {isFetching && !isLoading ? 'Memuat…' : `${total} catatan · waktu dalam WITA`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : isError ? (
                <div className="text-sm text-rose-600">{error instanceof Error ? error.message : 'Gagal memuat audit log'}</div>
              ) : rows.length === 0 ? (
                <div className="text-sm text-muted-foreground">Belum ada catatan untuk filter ini</div>
              ) : (
                <div className="w-full overflow-auto">
                  <Table className="text-xs md:text-sm">
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow className="border-b bg-muted/30">
                        <TableHead className="whitespace-nowrap">Waktu</TableHead>
                        <TableHead className="whitespace-nowrap">Pelaku</TableHead>
                        <TableHead className="whitespace-nowrap">Aksi</TableHead>
                        <TableHead className="whitespace-nowrap">Target</TableHead>
                        <TableHead className="whitespace-nowrap">Hasil</TableHead>
                        <TableHead className="whitespace-nowrap">Detail</TableHead>
                        <TableHead className="whitespace-nowrap">IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenRow(r)}>
                          <TableCell className="whitespace-nowrap font-mono py-2">{formatWita(r.created_at)}</TableCell>
                          <TableCell className="whitespace-nowrap py-2">
                            <div className="font-medium">{r.actor_name || '-'}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {ROLE_LABELS[String(r.actor_role || '')] || r.actor_role || ''}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap py-2">{actionLabel(r.action)}</TableCell>
                          <TableCell className="max-w-[240px] py-2">
                            <div className="truncate font-mono">{r.target_id || '-'}</div>
                            {r.target_label && <div className="truncate text-[11px] text-muted-foreground">{r.target_label}</div>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap py-2">
                            {r.result === 'FAIL' ? (
                              <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">Gagal</Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">OK</Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[320px] truncate py-2 text-muted-foreground">
                            {summarizeDetails(r.details) || '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono py-2 text-muted-foreground">{r.ip || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {!isLoading && !isError && total > 0 && (
                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>
                    Halaman {Math.min(page, totalPages)} dari {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!openRow} onOpenChange={(open) => !open && setOpenRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{openRow ? actionLabel(openRow.action) : ''}</DialogTitle>
            <DialogDescription>
              {openRow
                ? `${formatWita(openRow.created_at)} WITA · ${openRow.actor_name || '-'}${openRow.actor_role ? ` (${ROLE_LABELS[openRow.actor_role] || openRow.actor_role})` : ''}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {openRow && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Target: </span>
                <span className="font-mono">{[openRow.target_type, openRow.target_id].filter(Boolean).join(' ') || '-'}</span>
                {openRow.target_label && <span className="text-muted-foreground"> · {openRow.target_label}</span>}
              </div>
              <div>
                <span className="text-muted-foreground">Hasil: </span>
                {openRow.result === 'FAIL' ? 'Gagal' : 'OK'}
                <span className="text-muted-foreground"> · IP: </span>
                <span className="font-mono">{openRow.ip || '-'}</span>
              </div>
              <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                {openRow.details ? JSON.stringify(openRow.details, null, 2) : 'Tidak ada detail'}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
