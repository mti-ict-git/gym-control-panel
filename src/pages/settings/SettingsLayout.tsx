import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { User, Shield, Settings, Users, MessageCircle, Server, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  path: string;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, path, isActive, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

export default function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuperAdmin, isLoading } = useUserRole();
  const [configOpen, setConfigOpen] = useState(true);

  const currentPath = location.pathname;

  const mainNavItems = [
    { icon: User, label: 'Profile', path: '/settings/profile' },
    { icon: Shield, label: 'Security', path: '/settings/security' },
  ];

  const configNavItems = [
    { icon: Users, label: 'Active Directory', path: '/settings/config/active-directory' },
    { icon: MessageCircle, label: 'WhatsApp', path: '/settings/config/whatsapp' },
    { icon: Server, label: 'Controller', path: '/settings/config/controller' },
  ];

  const isConfigActive = configNavItems.some(item => currentPath === item.path);

  return (
    <AppLayout>
      <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-8rem)]">
        {/* Settings Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="bg-card rounded-xl border p-4 sticky top-4">
            <h2 className="text-lg font-semibold mb-4 px-3">Settings</h2>
            
            <nav className="space-y-1">
              {mainNavItems.map((item) => (
                <NavItem
                  key={item.path}
                  icon={item.icon}
                  label={item.label}
                  path={item.path}
                  isActive={currentPath === item.path}
                  onClick={() => navigate(item.path)}
                />
              ))}

              {/* Configuration Group - Only visible to SuperAdmin */}
              {!isLoading && isSuperAdmin && (
                <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isConfigActive
                          ? "text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Settings className="h-4 w-4" />
                        <span>Configuration</span>
                      </div>
                      {configOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 mt-1 space-y-1">
                    {configNavItems.map((item) => (
                      <NavItem
                        key={item.path}
                        icon={item.icon}
                        label={item.label}
                        path={item.path}
                        isActive={currentPath === item.path}
                        onClick={() => navigate(item.path)}
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </nav>
          </div>
        </aside>

        {/* Settings Content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </AppLayout>
  );
}
