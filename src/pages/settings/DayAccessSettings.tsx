import { CalendarDays } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DayAccessSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Day Access</h1>
        <p className="text-muted-foreground">Configure which days gym access is allowed.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Access Rules</CardTitle>
          </div>
          <CardDescription>Set day-based access policy (coming soon).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            This section will allow defining allowed days for gym access by role or department.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

