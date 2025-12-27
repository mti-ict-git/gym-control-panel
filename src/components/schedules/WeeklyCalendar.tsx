import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, Users } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, getWeek, isSameDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { GymSession, formatTime } from '@/hooks/useGymSessions';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface WeeklyCalendarProps {
  sessions: GymSession[];
  onCreateSession?: () => void;
}

const START_HOUR = 5;
const END_HOUR = 23;
const TIME_SLOTS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => {
  const hour = i + START_HOUR;
  return `${hour.toString().padStart(2, '0')}:00`;
});

const SESSION_COLORS = [
  'bg-emerald-100 border-l-4 border-emerald-500 text-emerald-800',
  'bg-blue-100 border-l-4 border-blue-500 text-blue-800',
  'bg-purple-100 border-l-4 border-purple-500 text-purple-800',
  'bg-amber-100 border-l-4 border-amber-500 text-amber-800',
  'bg-rose-100 border-l-4 border-rose-500 text-rose-800',
  'bg-cyan-100 border-l-4 border-cyan-500 text-cyan-800',
];

export function WeeklyCalendar({ sessions, onCreateSession }: WeeklyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekNumber = getWeek(currentDate, { weekStartsOn: 1 });

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setCurrentDate(date);
    }
  };

  const getSessionPosition = (session: GymSession) => {
    const [startHour, startMin] = session.time_start.split(':').map(Number);
    const [endHour, endMin] = session.time_end.split(':').map(Number);
    
    const startOffset = (startHour - START_HOUR) * 64 + (startMin / 60) * 64; // 64px per hour
    const duration = ((endHour - startHour) * 60 + (endMin - startMin)) / 60 * 64;
    
    return { top: startOffset, height: Math.max(duration, 32) };
  };

  // Assign colors to sessions
  const sessionColorMap = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((session, index) => {
      map.set(session.id, SESSION_COLORS[index % SESSION_COLORS.length]);
    });
    return map;
  }, [sessions]);

  return (
    <div className="flex gap-6">
      {/* Left sidebar with mini calendar */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <Card>
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="w-full pointer-events-auto"
            />
          </CardContent>
        </Card>

        {/* Sessions Legend */}
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-3">Sessions</h3>
            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center gap-2 text-sm">
                  <div className={cn(
                    "w-4 h-4 rounded",
                    sessionColorMap.get(session.id)?.split(' ')[0]
                  )} />
                  <span className="flex-1 truncate">{session.session_name}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatTime(session.time_start)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly view */}
      <div className="flex-1 min-w-0">
        {/* Header with navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handlePrevWeek}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNextWeek}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <h2 className="text-xl font-semibold">
              {format(weekStart, 'MMMM d')} - {format(addDays(weekStart, 6), 'd, yyyy')}
            </h2>
            <Badge variant="secondary" className="font-normal">
              Week {weekNumber}
            </Badge>
          </div>
          
          {onCreateSession && (
            <Button onClick={onCreateSession} className="bg-primary">
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          )}
        </div>

        {/* Week grid */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
              <div className="p-3" /> {/* Empty corner */}
              {weekDays.map((day, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-3 text-center border-l",
                    isSameDay(day, new Date()) && "bg-primary/5"
                  )}
                >
                  <div className="text-xs font-medium text-muted-foreground uppercase">
                    {format(day, 'EEE')}
                  </div>
                  <div className={cn(
                    "text-2xl font-semibold mt-1",
                    isSameDay(day, new Date()) && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
              {/* Time labels */}
              <div className="border-r">
                {TIME_SLOTS.map((time) => (
                  <div key={time} className="h-16 px-2 py-1 text-xs text-muted-foreground text-right border-b">
                    {time}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={cn(
                    "relative border-l",
                    isSameDay(day, new Date()) && "bg-primary/5"
                  )}
                >
                  {/* Hour grid lines */}
                  {TIME_SLOTS.map((_, index) => (
                    <div key={index} className="h-16 border-b" />
                  ))}

                  {/* Sessions - displayed on all days for now */}
                  {sessions.map((session) => {
                    const { top, height } = getSessionPosition(session);
                    const colorClass = sessionColorMap.get(session.id) || SESSION_COLORS[0];
                    
                    // Only show if within visible time range
                    const [startHour] = session.time_start.split(':').map(Number);
                    if (startHour < START_HOUR || startHour >= END_HOUR) return null;

                    return (
                      <Popover key={`${session.id}-${dayIndex}`}>
                        <PopoverTrigger asChild>
                          <div
                            className={cn(
                              "absolute left-1 right-1 rounded px-2 py-1 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity",
                              colorClass
                            )}
                            style={{ top: `${top}px`, height: `${height}px` }}
                          >
                            <div className="text-xs font-medium truncate">
                              {session.session_name}
                            </div>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" side="right">
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-semibold">{session.session_name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {format(day, 'EEEE, MMMM d')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {formatTime(session.time_start)} - {formatTime(session.time_end)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>Quota: {session.quota}</span>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
