import { useState } from 'react';
import { Users, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function ActiveDirectorySettings() {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [config, setConfig] = useState({
    server: '',
    domain: '',
    baseDn: '',
    bindUsername: '',
    bindPassword: '',
    port: '389',
    useSsl: false,
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('idle');
    
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (config.server && config.domain && config.bindUsername) {
      setConnectionStatus('success');
      toast({
        title: "Connection Successful",
        description: "Successfully connected to Active Directory server.",
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
    
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Configuration Saved",
      description: "Active Directory settings have been saved.",
    });
    
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Active Directory</h1>
        <p className="text-muted-foreground">Configure LDAP/Active Directory for user authentication</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
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
          <CardDescription>Configure your Active Directory server connection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="server">Server Address *</Label>
              <Input
                id="server"
                value={config.server}
                onChange={(e) => setConfig({ ...config, server: e.target.value })}
                placeholder="ldap://192.168.1.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: e.target.value })}
                placeholder="389"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Domain *</Label>
              <Input
                id="domain"
                value={config.domain}
                onChange={(e) => setConfig({ ...config, domain: e.target.value })}
                placeholder="corp.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseDn">Base DN</Label>
              <Input
                id="baseDn"
                value={config.baseDn}
                onChange={(e) => setConfig({ ...config, baseDn: e.target.value })}
                placeholder="DC=corp,DC=example,DC=com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bindUsername">Bind Username *</Label>
              <Input
                id="bindUsername"
                value={config.bindUsername}
                onChange={(e) => setConfig({ ...config, bindUsername: e.target.value })}
                placeholder="admin@corp.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bindPassword">Bind Password *</Label>
              <Input
                id="bindPassword"
                type="password"
                value={config.bindPassword}
                onChange={(e) => setConfig({ ...config, bindPassword: e.target.value })}
                placeholder="Enter password"
              />
            </div>
          </div>

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
    </div>
  );
}
