import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Settings, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGymLiveStatus } from '@/hooks/useGymLiveStatus';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Live', url: '/users', icon: Users, live: true },
  { title: 'Booking', url: '/gym_booking', icon: Database },
  { title: 'Schedules', url: '/schedules', icon: Calendar },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: livePeople } = useGymLiveStatus({ refetchInterval: 10_000 });

  const inGymCount = useMemo(() => {
    return (livePeople || []).filter((p) => p.status === 'IN_GYM').length;
  }, [livePeople]);

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
              <div className="relative flex flex-col items-center">
                <item.icon className="h-5 w-5 mb-1" />
                {item.live ? (
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/90 animate-pulse" />
                      LIVE{inGymCount > 0 ? ` ${inGymCount}` : ''}
                    </span>
                  </span>
                ) : null}
              </div>
              <span className="text-xs font-medium">{item.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
