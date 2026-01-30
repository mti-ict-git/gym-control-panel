import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Settings, 
  LogOut,
  Dumbbell,
  Database,
  FileText,
  UserCog
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const menuItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Live Gym', url: '/users', icon: Users },
  { title: 'Gym Booking', url: '/gym_booking', icon: Database },
  { title: 'Schedules', url: '/schedules', icon: Calendar },
  { title: 'Reports', url: '/reports', icon: FileText },
  { title: 'Management Account', url: '/management', icon: UserCog, superAdminOnly: true },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isSuperAdmin = (user?.role || '').toLowerCase() === 'superadmin';
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const preferDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', preferDark);
    setIsDark(preferDark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = user?.username || user?.email || 'Admin';
  const roleLabel = (() => {
    const r = (user?.role || '').toLowerCase();
    if (r === 'superadmin') return 'Super Admin';
    if (r === 'committee') return 'Committee';
    if (r === 'admin') return 'Administrator';
    return 'User';
  })();
  const roleBadge = (() => {
    const r = (user?.role || '').toLowerCase();
    if (r === 'superadmin') {
      return (
        <span className="inline-flex items-center rounded-md bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-medium">
          Super Admin
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">{roleLabel}</span>;
  })();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="h-14 flex-row items-center justify-between gap-3 border-b border-sidebar-border px-6 py-0">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Dumbbell className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-none text-sidebar-foreground">Super Gym</h2>
            <p className="truncate text-[11px] leading-none text-muted-foreground">Control Panel</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems
                .filter((item) => !item.superAdminOnly || isSuperAdmin)
                .map((item) => {
                  const isActive = location.pathname === item.url || 
                    (item.url !== '/dashboard' && location.pathname.startsWith(item.url));
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild
                        className={`touch-target ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}
                      >
                        <button onClick={() => navigate(item.url)} className="w-full">
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Separator className="mb-4" />
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <span className="text-sm font-medium text-muted-foreground">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p>{roleBadge}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start touch-target"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Copyright © 2026, Develop by Merdeka Tsingshan Indonesia v1.0.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
