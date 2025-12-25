import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Lock, Info, User, Plug, ExternalLink, Shield, Database, Cloud, Users, MessageCircle, Server } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Active Directory Config
  const [adServer, setAdServer] = useState('');
  const [adDomain, setAdDomain] = useState('');
  const [adUsername, setAdUsername] = useState('');
  const [adPassword, setAdPassword] = useState('');
  
  // WhatsApp Config
  const [waApiKey, setWaApiKey] = useState('');
  const [waPhoneNumber, setWaPhoneNumber] = useState('');
  const [waWebhookUrl, setWaWebhookUrl] = useState('');
  
  // Database Config
  const [dbServer, setDbServer] = useState('');
  const [dbName, setDbName] = useState('');
  const [dbUser, setDbUser] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [dbPort, setDbPort] = useState('1433');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Please fill in all password fields.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Validation Error",
        description: "New passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsUpdating(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = user?.user_metadata?.username || user?.email || 'Admin';

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and system settings.</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Admin Profile</CardTitle>
            </div>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-lg">{displayName}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Change Password</CardTitle>
            </div>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="touch-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="touch-target"
                />
              </div>
              <Button type="submit" className="touch-target" disabled={isUpdating}>
                {isUpdating ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Integrations</CardTitle>
            </div>
            <CardDescription>Connect external systems and services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">HashiCorp Vault</p>
                  <p className="text-sm text-muted-foreground">Secrets management & encryption</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Not Connected</Badge>
                <Button variant="outline" size="sm" className="touch-target">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Connect
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">HR System</p>
                  <p className="text-sm text-muted-foreground">Employee data sync</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Not Connected</Badge>
                <Button variant="outline" size="sm" className="touch-target">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Connect
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Cloud className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Access Control System</p>
                  <p className="text-sm text-muted-foreground">Door & turnstile integration</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Not Connected</Badge>
                <Button variant="outline" size="sm" className="touch-target">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Connect
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Directory Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Active Directory</CardTitle>
            </div>
            <CardDescription>Configure LDAP/Active Directory for user authentication</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adServer">Server Address</Label>
                <Input
                  id="adServer"
                  value={adServer}
                  onChange={(e) => setAdServer(e.target.value)}
                  placeholder="ldap://192.168.1.1"
                  className="touch-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adDomain">Domain</Label>
                <Input
                  id="adDomain"
                  value={adDomain}
                  onChange={(e) => setAdDomain(e.target.value)}
                  placeholder="corp.example.com"
                  className="touch-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adUsername">Bind Username</Label>
                <Input
                  id="adUsername"
                  value={adUsername}
                  onChange={(e) => setAdUsername(e.target.value)}
                  placeholder="admin@corp.example.com"
                  className="touch-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adPassword">Bind Password</Label>
                <Input
                  id="adPassword"
                  type="password"
                  value={adPassword}
                  onChange={(e) => setAdPassword(e.target.value)}
                  placeholder="Enter password"
                  className="touch-target"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="touch-target">
                Test Connection
              </Button>
              <Button className="touch-target">
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">WhatsApp Integration</CardTitle>
            </div>
            <CardDescription>Configure WhatsApp Business API for notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="waApiKey">API Key</Label>
                <Input
                  id="waApiKey"
                  type="password"
                  value={waApiKey}
                  onChange={(e) => setWaApiKey(e.target.value)}
                  placeholder="Enter API key"
                  className="touch-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waPhoneNumber">Phone Number ID</Label>
                <Input
                  id="waPhoneNumber"
                  value={waPhoneNumber}
                  onChange={(e) => setWaPhoneNumber(e.target.value)}
                  placeholder="+62812xxxxx"
                  className="touch-target"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="waWebhookUrl">Webhook URL</Label>
                <Input
                  id="waWebhookUrl"
                  value={waWebhookUrl}
                  onChange={(e) => setWaWebhookUrl(e.target.value)}
                  placeholder="https://your-webhook-url.com/webhook"
                  className="touch-target"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="touch-target">
                Send Test Message
              </Button>
              <Button className="touch-target">
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Database Management Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Database Management</CardTitle>
            </div>
            <CardDescription>Configure external database connections (SQL Server, MySQL, etc.)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dbServer">Server Address</Label>
                <Input
                  id="dbServer"
                  value={dbServer}
                  onChange={(e) => setDbServer(e.target.value)}
                  placeholder="10.60.10.47"
                  className="touch-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dbPort">Port</Label>
                <Input
                  id="dbPort"
                  value={dbPort}
                  onChange={(e) => setDbPort(e.target.value)}
                  placeholder="1433"
                  className="touch-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dbName">Database Name</Label>
                <Input
                  id="dbName"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  placeholder="GymDB"
                  className="touch-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dbUser">Username</Label>
                <Input
                  id="dbUser"
                  value={dbUser}
                  onChange={(e) => setDbUser(e.target.value)}
                  placeholder="db_user"
                  className="touch-target"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="dbPassword">Password</Label>
                <Input
                  id="dbPassword"
                  type="password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  placeholder="Enter database password"
                  className="touch-target"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="touch-target">
                Test Connection
              </Button>
              <Button className="touch-target">
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">System Information</CardTitle>
            </div>
            <CardDescription>Application details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Environment</span>
              <span className="font-medium">Production</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="font-medium">December 2024</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg text-destructive">Sign Out</CardTitle>
            </div>
            <CardDescription>End your current session</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              onClick={handleLogout}
              className="touch-target"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
