import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        
        <main className="flex-1 flex flex-col min-h-screen">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-card px-4 md:hidden">
            <SidebarTrigger className="md:hidden" />
            <h1 className="font-semibold">Gym Admin</h1>
          </header>
          
          <div className="flex-1 p-4 md:p-6 pb-20 md:pb-6 animate-fade-in">
            {children}
          </div>
        </main>
        
        <BottomNav />
      </div>
    </SidebarProvider>
  );
}
