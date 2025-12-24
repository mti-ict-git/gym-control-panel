import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  onClick: () => void;
  className?: string;
}

export function FloatingActionButton({ onClick, className }: FloatingActionButtonProps) {
  return (
    <Button
      size="lg"
      className={cn(
        "fixed bottom-24 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full shadow-lg z-40",
        "hover:scale-105 active:scale-95 transition-transform",
        className
      )}
      onClick={onClick}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
