import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Supabase removed: using GymDB backend only
import { toast } from 'sonner';
import { UserCog, Shield, Users, UserPlus, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type AppRole = 'admin' | 'user' | 'superadmin' | 'committee';

interface GymAccount {
  account_id: number;
  email: string;
  username: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in?: string | null;
  last_sign_in_at?: string | null;
}

export default function ManagementPage() {
  const [accounts, setAccounts] = useState<GymAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number>(0);
  const [editUsername, setEditUsername] = useState<string>('');
  const [editRole, setEditRole] = useState<AppRole>('user');
  const [isDeletingUserId, setIsDeletingUserId] = useState<number>(0);
  const [editEmail, setEditEmail] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editConfirmPassword, setEditConfirmPassword] = useState<string>('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/gym-accounts');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to fetch accounts');
      setAccounts(json.accounts as GymAccount[]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (accountId: number, newRole: AppRole) => {
    try {
      const res = await fetch(`/api/gym-accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to update role');
      toast.success('Role updated successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const isPasswordComplex = (pwd: string) => {
    const hasMinLen = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
    return hasMinLen && hasUpper && hasLower && hasNumber && hasSymbol;
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserUsername) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!isPasswordComplex(newUserPassword)) {
      toast.error('Password must be 8+ chars, include upper, lower, number, symbol');
      return;
    }

    if (newUserPassword !== newUserConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsCreating(true);
    try {
      // Create account directly in GymDB
      const resp = await fetch('/api/gym-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUserUsername, email: newUserEmail, role: newUserRole, is_active: true, password: newUserPassword }),
      });
      const j = await resp.json();
      if (!j.ok) {
        toast.error(j.error || 'Failed to create gym account');
      } else {
        toast.success('Account created successfully');
      }

      setIsCreateDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserUsername('');
      setNewUserConfirmPassword('');
      setNewUserRole('admin');
      fetchUsers();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create account';
      console.error('Error creating user:', error);
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const openEditDialog = (acc: GymAccount) => {
    setEditUserId(acc.account_id);
    setEditUsername(acc.username);
    setEditRole(acc.role);
    setEditEmail(acc.email || '');
    setEditPassword('');
    setEditConfirmPassword('');
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    try {
      if (editPassword || editConfirmPassword) {
        if (!isPasswordComplex(editPassword)) {
          toast.error('Password must be 8+ chars, include upper, lower, number, symbol');
          return;
        }
        if (editPassword !== editConfirmPassword) {
          toast.error('Passwords do not match');
          return;
        }
        toast.info('Password update requires admin API; not applied from client');
      }

      if (editEmail && editEmail.trim().length > 0) {
        // Email update requires Supabase Admin API (service role). We only acknowledge here.
        toast.info('Email update requires admin API; not applied from client');
      }

      const payload: { username?: string; role?: AppRole; email?: string; password?: string } = {
        username: editUsername,
        role: editRole,
      };
      if (editEmail && editEmail.trim().length > 0) payload.email = editEmail;
      if (editPassword) payload.password = editPassword;
      const res = await fetch(`/api/gym-accounts/${editUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to update account');
      toast.success('User updated');
      setIsEditDialogOpen(false);
      setShowEditPassword(false);
      setShowEditConfirmPassword(false);
      setEditPassword('');
      setEditConfirmPassword('');
      fetchUsers();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update user';
      toast.error(msg);
    }
  };

  const handleDeleteUser = async () => {
    try {
      const accountId = isDeletingUserId;
      const res = await fetch(`/api/gym-accounts/${accountId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to delete');
      toast.success('User removed from listing');
      setIsDeletingUserId(0);
      fetchUsers();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete user';
      toast.error(msg);
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'superadmin':
        return 'destructive';
      case 'committee':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleLabel = (role: AppRole) => {
    switch (role) {
      case 'superadmin':
        return 'Super Admin';
      case 'committee':
        return 'Committee';
      case 'admin':
        return 'Admin';
      default:
        return 'User';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <UserCog className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Management Account</h1>
            <p className="text-muted-foreground">Manage user roles and permissions</p>
          </div>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Create Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Account</DialogTitle>
              <DialogDescription>Create a new user account with a specific role.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  placeholder="Enter username"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Enter email"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Enter password (min 8, upper/lower/number/symbol)"
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Re-confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={newUserConfirmPassword}
                    onChange={(e) => setNewUserConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as AppRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                    <SelectItem value="committee">Committee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Shield className="h-5 w-5 text-destructive" />
              <div>
                <CardTitle className="text-lg">Super Admin</CardTitle>
                <CardDescription>Full system access and configuration</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {accounts.filter((a) => a.role === 'superadmin').length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Committee</CardTitle>
                <CardDescription>Committee members with elevated access</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {accounts.filter((a) => a.role === 'committee').length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Accounts</CardTitle>
            <CardDescription>View and manage user roles</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">No</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Last Sign In</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Change Role</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((acc, index) => (
                    <TableRow key={acc.account_id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{acc.username}</TableCell>
                      <TableCell>{acc.email || '-'}</TableCell>
                      <TableCell>{acc.last_sign_in ? new Date(acc.last_sign_in).toLocaleString() : (acc.last_sign_in_at ? new Date(acc.last_sign_in_at).toLocaleString() : '-')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={getRoleBadgeVariant(acc.role)}>{getRoleLabel(acc.role)}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          onValueChange={(value) => handleRoleChange(acc.account_id, value as AppRole)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="superadmin">Super Admin</SelectItem>
                            <SelectItem value="committee">Committee</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(acc)} aria-label="Edit user">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsDeletingUserId(acc.account_id)}
                                aria-label="Delete user"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete user</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes the user from the listing and clears assigned roles.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setIsDeletingUserId(0)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteUser}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update username and role.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Enter username"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Enter email (admin-managed)"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-password">Password</Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Set new password (min 8, upper/lower/number/symbol)"
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showEditPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-confirm-password">Re-confirm Password</Label>
                <div className="relative">
                  <Input
                    id="edit-confirm-password"
                    type={showEditConfirmPassword ? 'text' : 'password'}
                    value={editConfirmPassword}
                    onChange={(e) => setEditConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showEditConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select value={editRole} onValueChange={(value) => setEditRole(value as AppRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                    <SelectItem value="committee">Committee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateUser}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
