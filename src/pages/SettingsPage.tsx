import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Lock, Info, User } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { admin, logout } = useAuth();
  const { toast } = useToast();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
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

    // Mock password change
    toast({
      title: "Password Updated",
      description: "Your password has been changed successfully.",
    });

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
                {admin?.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-lg">{admin?.username}</p>
                <p className="text-sm text-muted-foreground">Administrator</p>
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
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="touch-target"
                />
              </div>
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
              <Button type="submit" className="touch-target">
                Update Password
              </Button>
            </form>
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
