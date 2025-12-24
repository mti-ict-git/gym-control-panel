import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Users', url: '/users', icon: Users },
  { title: 'Schedules', url: '/schedules', icon: Calendar },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url || 
            (item.url !== '/dashboard' && location.pathname.startsWith(item.url));
          
          return (
            <button
              key={item.title}
              onClick={() => navigate(item.url)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center py-3 px-2 touch-target transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">{item.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
