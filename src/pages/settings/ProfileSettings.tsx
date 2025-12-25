import { User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileSettings() {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.username || user?.email || 'Admin';

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
              <p className="font-mono text-sm truncate">{user?.id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Sign In</p>
              <p className="text-sm">
                {user?.last_sign_in_at 
                  ? new Date(user.last_sign_in_at).toLocaleString()
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Created</p>
              <p className="text-sm">
                {user?.created_at 
                  ? new Date(user.created_at).toLocaleString()
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email Verified</p>
              <p className="text-sm">
                {user?.email_confirmed_at ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
