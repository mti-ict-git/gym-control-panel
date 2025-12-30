import { User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export default function ProfileSettings() {
  const { user } = useAuth();
  const displayName = user?.username || user?.email || 'Admin';

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
    const d = new Date(iat * 1000);
    return d.toLocaleString();
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

  const qc = useQueryClient();
  useEffect(() => {
    const run = async () => {
      try {
        if (!token) return;
        const resp = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }).catch(() => fetch('/auth/me', { headers: { Authorization: `Bearer ${token}` } }));
        await resp.json().catch(() => ({}));
        await qc.invalidateQueries({ queryKey: ['profile-account', user?.account_id] });
      } catch {
        // ignore
      }
    };
    void run();
  }, [qc, token, user?.account_id]);

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
              <p className="text-sm">{(() => {
                const server = accountInfo?.last_sign_in
                  ? new Date(accountInfo.last_sign_in)
                  : (accountInfo?.last_sign_in_at ? new Date(accountInfo.last_sign_in_at) : null);
                const client = typeof payload?.iat === 'number' ? new Date(payload.iat * 1000) : null;
                const best = server && client ? (server.getTime() >= client.getTime() ? server : client) : (server || client);
                return best ? best.toLocaleString() : 'N/A';
              })()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Sign In (legacy)</p>
              <p className="text-sm">{accountInfo?.last_sign_in_at ? new Date(accountInfo.last_sign_in_at).toLocaleString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Created</p>
              <p className="text-sm">{accountInfo?.created_at ? new Date(accountInfo.created_at).toLocaleString() : 'N/A'}</p>
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
