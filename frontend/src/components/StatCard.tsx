import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  badgeText?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  sparklineData?: Array<{ x: number | string; y: number }> | null;
}

function variantClasses(variant: StatCardProps['variant']) {
  if (variant === 'success') return 'bg-green-50 dark:bg-green-950/10';
  if (variant === 'warning') return 'bg-yellow-50 dark:bg-yellow-950/10';
  if (variant === 'destructive') return 'bg-red-50 dark:bg-red-950/10';
  if (variant === 'info') return 'bg-blue-50 dark:bg-blue-950/10';
  return 'bg-muted/30';
}

export function StatCard({ title, value, icon: Icon, onClick, className, variant = 'default', badgeText, badgeVariant = 'secondary', sparklineData }: StatCardProps) {
  return (
    <Card 
      className={cn(
        "card-interactive",
        variantClasses(variant),
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {badgeText ? <Badge variant={badgeVariant}>{badgeText}</Badge> : null}
            </div>
            <p className="text-5xl font-bold mt-1 leading-tight">{value}</p>
          </div>
          <div className="relative flex h-12 w-24 items-center justify-end">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            {sparklineData && sparklineData.length > 0 ? (
              <div className="absolute right-0 top-0 h-12 w-24">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData.map((d) => ({ x: d.x, y: d.y }))}>
                    <Area type="monotone" dataKey="y" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.15)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
