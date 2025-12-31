import { User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

export default function ProfileSettings() {
  const { user } = useAuth();
  const displayName = user?.username || user?.email || 'Admin';

  const parseDateValue = (value: unknown): Date | null => {
    if (value == null) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value !== 'string') return null;
    const s = value.trim();
    if (!s) return null;

    if (/^\d{10}$/.test(s)) return parseDateValue(Number(s) * 1000);
    if (/^\d{13}$/.test(s)) return parseDateValue(Number(s));

    const mDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (mDateOnly) {
      const year = Number(mDateOnly[1]);
      const month = Number(mDateOnly[2]);
      const day = Number(mDateOnly[3]);
      const d = new Date(year, month - 1, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const hasExplicitTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
    if (hasExplicitTz) {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;

      if (/[zZ]$/.test(s)) {
        const withoutZ = s.replace(/[zZ]$/, '');
        const mIsoNoTz = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(withoutZ);
        if (mIsoNoTz) {
          const year = Number(mIsoNoTz[1]);
          const month = Number(mIsoNoTz[2]);
          const day = Number(mIsoNoTz[3]);
          const hour = Number(mIsoNoTz[4]);
          const minute = Number(mIsoNoTz[5]);
          const second = mIsoNoTz[6] != null ? Number(mIsoNoTz[6]) : 0;
          const ms = mIsoNoTz[7] != null ? Number(mIsoNoTz[7].padEnd(3, '0')) : 0;
          const localNaive = new Date(year, month - 1, day, hour, minute, second, ms);
          if (!Number.isNaN(localNaive.getTime())) {
            const now = Date.now();
            const grace = 2 * 60_000;
            if (d.getTime() > now + grace && localNaive.getTime() <= now + grace) return localNaive;
          }
        }
      }

      return d;
    }

    const mIsoNoTz = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(s);
    if (mIsoNoTz) {
      const year = Number(mIsoNoTz[1]);
      const month = Number(mIsoNoTz[2]);
      const day = Number(mIsoNoTz[3]);
      const hour = Number(mIsoNoTz[4]);
      const minute = Number(mIsoNoTz[5]);
      const second = mIsoNoTz[6] != null ? Number(mIsoNoTz[6]) : 0;
      const ms = mIsoNoTz[7] != null ? Number(mIsoNoTz[7].padEnd(3, '0')) : 0;
      const d = new Date(year, month - 1, day, hour, minute, second, ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const mSpaceNoTz = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(s);
    if (mSpaceNoTz) {
      const year = Number(mSpaceNoTz[1]);
      const month = Number(mSpaceNoTz[2]);
      const day = Number(mSpaceNoTz[3]);
      const hour = Number(mSpaceNoTz[4]);
      const minute = Number(mSpaceNoTz[5]);
      const second = mSpaceNoTz[6] != null ? Number(mSpaceNoTz[6]) : 0;
      const ms = mSpaceNoTz[7] != null ? Number(mSpaceNoTz[7].padEnd(3, '0')) : 0;
      const d = new Date(year, month - 1, day, hour, minute, second, ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const formatDateTimeLocal = (value: unknown): string => {
    const d = parseDateValue(value);
    if (!d) return 'N/A';
    return d.toLocaleString();
  };

  function decodeJwt(token: string | null) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    try {
      const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Record<string, unknown>;
      return payload;
    } catch {
      return null;
    }
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const payload = decodeJwt(token);
  const lastSignIn = (() => {
    const iat = typeof payload?.iat === 'number' ? payload.iat : null;
    if (!iat) return 'N/A';
    return formatDateTimeLocal(iat * 1000);
  })();

  const { data: accountInfo } = useQuery({
    queryKey: ['profile-account', user?.account_id],
    queryFn: async () => {
      if (!user?.account_id) return null as { created_at: string | null; email_verified: boolean; last_sign_in: string | null; last_sign_in_at: string | null } | null;
      const resp = await fetch('/api/gym-accounts').catch(() => fetch('/gym-accounts'));
      const json = await resp.json();
      if (!json?.ok) return null as { created_at: string | null; email_verified: boolean; last_sign_in: string | null; last_sign_in_at: string | null } | null;
      const found = Array.isArray(json.accounts) ? json.accounts.find((a: { account_id: number }) => Number(a.account_id) === Number(user.account_id)) : null;
      if (!found) return null as { created_at: string | null; email_verified: boolean; last_sign_in: string | null; last_sign_in_at: string | null } | null;
      return { created_at: typeof found.created_at === 'string' ? found.created_at : null, email_verified: Boolean(found.email_verified), last_sign_in: typeof found.last_sign_in === 'string' ? found.last_sign_in : null, last_sign_in_at: typeof found.last_sign_in_at === 'string' ? found.last_sign_in_at : null } as { created_at: string | null; email_verified: boolean; last_sign_in: string | null; last_sign_in_at: string | null };
    },
    enabled: !!user?.account_id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account information</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Admin Profile</CardTitle>
          </div>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-semibold">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-xl">{displayName}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="font-mono text-sm truncate">{user?.account_id ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Sign In</p>
              <p className="text-sm">{accountInfo?.last_sign_in ? formatDateTimeLocal(accountInfo.last_sign_in) : (accountInfo?.last_sign_in_at ? formatDateTimeLocal(accountInfo.last_sign_in_at) : lastSignIn)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Sign In (legacy)</p>
              <p className="text-sm">{accountInfo?.last_sign_in_at ? formatDateTimeLocal(accountInfo.last_sign_in_at) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Created</p>
              <p className="text-sm">{accountInfo?.created_at ? formatDateTimeLocal(accountInfo.created_at) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email Verified</p>
              <p className="text-sm">{accountInfo?.email_verified ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
