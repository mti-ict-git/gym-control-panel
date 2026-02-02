import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OccupancyCardProps {
  currentOccupancy: number;
  maxCapacity?: number;
  isLoading?: boolean;
}

export function OccupancyCard({ currentOccupancy, maxCapacity = 15, isLoading = false }: OccupancyCardProps) {
  const navigate = useNavigate();
  
  const getColorClass = () => {
    if (currentOccupancy >= maxCapacity) {
      return 'border-red-500 bg-red-50 dark:bg-red-950/20';
    } else if (currentOccupancy >= 12) {
      return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
    } else {
      return 'border-green-500 bg-green-50 dark:bg-green-950/20';
    }
  };

  const getTextColorClass = () => {
    if (currentOccupancy >= maxCapacity) {
      return 'text-red-700 dark:text-red-400';
    } else if (currentOccupancy >= 12) {
      return 'text-yellow-700 dark:text-yellow-400';
    } else {
      return 'text-green-700 dark:text-green-400';
    }
  };

  const getStatusText = () => {
    if (currentOccupancy >= maxCapacity) {
      return 'FULL';
    } else if (currentOccupancy >= 12) {
      return 'Almost Full';
    } else {
      return 'Available';
    }
  };

  return (
    <Card 
      className={cn(
        'card-interactive border-2 transition-all',
        getColorClass()
      )}
      onClick={() => navigate('/live_gym')}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Gym Occupancy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className={cn('text-4xl font-bold', getTextColorClass())}>
              {isLoading ? '—' : currentOccupancy}
              <span className="text-2xl font-normal text-muted-foreground"> / {maxCapacity}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">People Inside</p>
          </div>
          <div className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium',
            currentOccupancy >= maxCapacity 
              ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200' 
              : currentOccupancy >= 12 
                ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                : 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200'
          )}>
            {getStatusText()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
