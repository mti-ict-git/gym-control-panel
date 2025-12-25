import { useState } from 'react';
import { Server, CheckCircle, XCircle, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export default function DatabaseSettings() {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [config, setConfig] = useState({
    type: 'sqlserver',
    server: '',
    port: '1433',
    database: '',
    username: '',
    password: '',
    encrypt: false,
    trustServerCertificate: true,
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('idle');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (config.server && config.database && config.username) {
      setConnectionStatus('success');
      toast({
        title: "Connection Successful",
        description: `Successfully connected to ${config.database} on ${config.server}`,
      });
    } else {
      setConnectionStatus('error');
      toast({
        title: "Connection Failed",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
    }
    
    setIsTesting(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Configuration Saved",
      description: "Database connection settings have been saved.",
    });
    
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Database Management</h1>
        <p className="text-muted-foreground">Configure external database connections</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Connection Settings</CardTitle>
            </div>
            {connectionStatus === 'success' && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            )}
            {connectionStatus === 'error' && (
              <Badge variant="outline" className="text-destructive border-destructive">
                <XCircle className="h-3 w-3 mr-1" />
                Failed
              </Badge>
            )}
          </div>
          <CardDescription>Configure your external database server connection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="type">Database Type</Label>
              <Select
                value={config.type}
                onValueChange={(value) => setConfig({ ...config, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select database type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sqlserver">Microsoft SQL Server</SelectItem>
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="postgresql">PostgreSQL</SelectItem>
                  <SelectItem value="oracle">Oracle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="server">Server Address *</Label>
              <Input
                id="server"
                value={config.server}
                onChange={(e) => setConfig({ ...config, server: e.target.value })}
                placeholder="10.60.10.47"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: e.target.value })}
                placeholder="1433"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="database">Database Name *</Label>
              <Input
                id="database"
                value={config.database}
                onChange={(e) => setConfig({ ...config, database: e.target.value })}
                placeholder="GymDB"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder="db_user"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder="Enter database password"
              />
            </div>
          </div>

          {config.type === 'sqlserver' && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium text-sm">SQL Server Options</h4>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Encrypt Connection</Label>
                  <p className="text-sm text-muted-foreground">Use encrypted connection to database</p>
                </div>
                <Switch
                  checked={config.encrypt}
                  onCheckedChange={(checked) => setConfig({ ...config, encrypt: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Trust Server Certificate</Label>
                  <p className="text-sm text-muted-foreground">Trust self-signed certificates</p>
                </div>
                <Switch
                  checked={config.trustServerCertificate}
                  onCheckedChange={(checked) => setConfig({ ...config, trustServerCertificate: checked })}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Connection Info</CardTitle>
          </div>
          <CardDescription>Current database connection details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Server</p>
              <p className="font-mono">{config.server || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Port</p>
              <p className="font-mono">{config.port || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Database</p>
              <p className="font-mono">{config.database || '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-mono capitalize">{config.type}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
