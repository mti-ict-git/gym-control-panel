import { Badge } from '@/components/ui/badge';
import { ScheduleStatus } from '@/hooks/useGymSchedules';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ScheduleStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = {
    BOOKED: {
      label: 'Booked',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    },
    IN_GYM: {
      label: 'In Gym',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    },
    OUT: {
      label: 'Out',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    },
  };

  const config = statusConfig[status];

  return (
    <Badge variant="secondary" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}
