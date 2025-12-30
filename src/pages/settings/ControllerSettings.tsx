import { Server } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ControllerSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Controller</h1>
        <p className="text-muted-foreground">Configure controller settings</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Controller Settings</CardTitle>
          </div>
          <CardDescription>Manage controller identifiers and connectivity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">No configuration fields yet.</div>
        </CardContent>
      </Card>
    </div>
  );
}
