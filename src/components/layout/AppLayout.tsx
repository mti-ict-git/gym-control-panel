import { useEffect, useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { BottomNav } from './BottomNav';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
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
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col min-h-screen">
          {/* Desktop header with sidebar trigger */}
          <header className="sticky top-0 z-40 hidden md:flex h-14 items-center gap-4 border-b border-border bg-card px-4">
            <SidebarTrigger />
          </header>
          
          {/* Mobile header */}
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-border bg-card px-4 md:hidden">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h1 className="font-semibold">Gym Admin</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
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
