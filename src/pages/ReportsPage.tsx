import { useState } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { FileText, Download, Calendar, Users, Clock, TrendingUp, Filter } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type DateRange = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom';

interface AttendanceRecord {
  id: string;
  gym_user_id: string;
  schedule_time: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  gym_users: {
    name: string;
    employee_id: string;
    department: string | null;
  } | null;
}

function getDateRange(range: DateRange, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const now = new Date();
  
  switch (range) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'custom':
      return { 
        start: customStart ? startOfDay(customStart) : startOfDay(now), 
        end: customEnd ? endOfDay(customEnd) : endOfDay(now) 
      };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

function formatDuration(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return '-';
  
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
    case 'CHECKED_OUT':
      return <Badge variant="outline" className="text-green-600 border-green-600">Completed</Badge>;
    case 'IN_GYM':
      return <Badge variant="outline" className="text-blue-600 border-blue-600">In Gym</Badge>;
    case 'BOOKED':
      return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Booked</Badge>;
    case 'NO_SHOW':
      return <Badge variant="outline" className="text-red-600 border-red-600">No Show</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { start, end } = getDateRange(
    dateRange,
    customStartDate ? new Date(customStartDate) : undefined,
    customEndDate ? new Date(customEndDate) : undefined
  );

  const { data: attendanceData = [], isLoading } = useQuery({
    queryKey: ['attendance-report', dateRange, customStartDate, customEndDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gym_schedules')
        .select(`
          id,
          gym_user_id,
          schedule_time,
          check_in_time,
          check_out_time,
          status,
          gym_users (
            name,
            employee_id,
            department
          )
        `)
        .gte('schedule_time', start.toISOString())
        .lte('schedule_time', end.toISOString())
        .order('schedule_time', { ascending: false });

      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });

  // Calculate statistics
  const stats = {
    totalBookings: attendanceData.length,
    checkedIn: attendanceData.filter(r => r.check_in_time).length,
    completed: attendanceData.filter(r => r.status === 'COMPLETED' || r.status === 'CHECKED_OUT').length,
    noShow: attendanceData.filter(r => r.status === 'NO_SHOW').length,
    uniqueUsers: new Set(attendanceData.map(r => r.gym_user_id)).size,
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Employee ID', 'Name', 'Department', 'Check In', 'Check Out', 'Duration', 'Status'];
    const rows = attendanceData.map(record => [
      format(new Date(record.schedule_time), 'yyyy-MM-dd'),
      record.gym_users?.employee_id || '-',
      record.gym_users?.name || '-',
      record.gym_users?.department || '-',
      record.check_in_time ? format(new Date(record.check_in_time), 'HH:mm') : '-',
      record.check_out_time ? format(new Date(record.check_out_time), 'HH:mm') : '-',
      formatDuration(record.check_in_time, record.check_out_time),
      record.status,
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gym-attendance-${format(start, 'yyyy-MM-dd')}-to-${format(end, 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Attendance Reports</h1>
            <p className="text-muted-foreground">
              View and export gym attendance data
            </p>
          </div>
          <Button onClick={handleExportCSV} disabled={attendanceData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Date Filter</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateRange === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-[180px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-[180px]"
                    />
                  </div>
                </>
              )}

              <div className="text-sm text-muted-foreground">
                Showing: {format(start, 'MMM d, yyyy')} - {format(end, 'MMM d, yyyy')}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-bold">{stats.totalBookings}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Checked In</p>
                  <p className="text-2xl font-bold">{stats.checkedIn}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-500/10 p-2">
                  <Users className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">No Show</p>
                  <p className="text-2xl font-bold">{stats.noShow}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-500/10 p-2">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unique Users</p>
                  <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Attendance Records</CardTitle>
            </div>
            <CardDescription>
              {attendanceData.length} records found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : attendanceData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No attendance records found for this period.</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceData.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(record.schedule_time), 'yyyy-MM-dd')}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {record.gym_users?.employee_id || '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {record.gym_users?.name || '-'}
                        </TableCell>
                        <TableCell>
                          {record.gym_users?.department || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {record.check_in_time 
                            ? format(new Date(record.check_in_time), 'HH:mm') 
                            : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {record.check_out_time 
                            ? format(new Date(record.check_out_time), 'HH:mm') 
                            : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {formatDuration(record.check_in_time, record.check_out_time)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(record.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
