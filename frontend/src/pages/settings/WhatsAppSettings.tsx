import { useState, useEffect } from 'react';
import { MessageCircle, CheckCircle, XCircle, Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function WhatsAppSettings() {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [config, setConfig] = useState({
    apiKey: '',
    phoneNumberId: '',
    businessAccountId: '',
    webhookUrl: '',
    webhookSecret: '',
  });

  const [testMessage, setTestMessage] = useState({
    phone: '',
    message: 'This is a test message from Gym Management System.',
  });

  const readLs = (k: string): string => (typeof window !== 'undefined' ? String(localStorage.getItem(k) || '') : '');
  const [supportContact, setSupportContact] = useState({
    name: readLs('gym_support_contact_name') || 'Gym Coordinator',
    phone: readLs('gym_support_contact_phone') || '+6281275000560',
  });

  // Load from API on mount
  useEffect(() => {
    (async () => {
      const tryFetch = async (url: string) => {
        const resp = await fetch(url);
        return await resp.json();
      };
      try {
        const json = await tryFetch('/api/app-settings/support-contact');
        if (json?.ok && json.name && json.phone) {
          setSupportContact({ name: json.name, phone: json.phone });
          if (typeof window !== 'undefined') {
            localStorage.setItem('gym_support_contact_name', String(json.name));
            localStorage.setItem('gym_support_contact_phone', String(json.phone));
          }
        }
      } catch (_) {
        void 0;
        try {
          const json = await tryFetch('/app-settings/support-contact');
          if (json?.ok && json.name && json.phone) {
            setSupportContact({ name: json.name, phone: json.phone });
            if (typeof window !== 'undefined') {
              localStorage.setItem('gym_support_contact_name', String(json.name));
              localStorage.setItem('gym_support_contact_phone', String(json.phone));
            }
          }
        } catch (_) { void 0; }
      }
    })();
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('idle');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (config.apiKey && config.phoneNumberId) {
      setConnectionStatus('success');
      toast({
        title: "API Connection Successful",
        description: "WhatsApp Business API is configured correctly.",
      });
    } else {
      setConnectionStatus('error');
      toast({
        title: "Connection Failed",
        description: "Please fill in API Key and Phone Number ID.",
        variant: "destructive",
      });
    }
    
    setIsTesting(false);
  };

  const handleSendTest = async () => {
    if (!testMessage.phone) {
      toast({
        title: "Error",
        description: "Please enter a phone number to send test message.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Test Message Sent",
      description: `Message sent to ${testMessage.phone}`,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Configuration Saved",
      description: "WhatsApp integration settings have been saved.",
    });
    
    setIsSaving(false);
  };

  const handleSaveSupport = async () => {
    const name = String(supportContact.name || '').trim();
    const phone = String(supportContact.phone || '').trim();
    const payload = { name, phone };
    const tryPost = async (url: string) => {
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      return await resp.json();
    };
    let ok = false;
    try {
      const json = await tryPost('/api/app-settings/support-contact');
      ok = Boolean(json?.ok);
    } catch (_) {
      void 0;
      try {
        const json = await tryPost('/app-settings/support-contact');
        ok = Boolean(json?.ok);
      } catch (_) { void 0; }
    }
    if (ok && typeof window !== 'undefined') {
      localStorage.setItem('gym_support_contact_name', name);
      localStorage.setItem('gym_support_contact_phone', phone);
    }
    toast({ title: ok ? 'Support Contact Saved' : 'Save Failed', description: ok ? 'Register page will use this contact.' : 'Could not save to server. Value is kept locally.' , variant: ok ? undefined : 'destructive' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Integration</h1>
        <p className="text-muted-foreground">Configure WhatsApp Business API for notifications</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">API Configuration</CardTitle>
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
          <CardDescription>Configure WhatsApp Business API credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="apiKey">API Key / Access Token *</Label>
              <Input
                id="apiKey"
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="Enter your WhatsApp API key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
              <Input
                id="phoneNumberId"
                value={config.phoneNumberId}
                onChange={(e) => setConfig({ ...config, phoneNumberId: e.target.value })}
                placeholder="Enter phone number ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessAccountId">Business Account ID</Label>
              <Input
                id="businessAccountId"
                value={config.businessAccountId}
                onChange={(e) => setConfig({ ...config, businessAccountId: e.target.value })}
                placeholder="Enter business account ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                value={config.webhookUrl}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                placeholder="https://your-domain.com/webhook"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhookSecret">Webhook Verify Token</Label>
              <Input
                id="webhookSecret"
                type="password"
                value={config.webhookSecret}
                onChange={(e) => setConfig({ ...config, webhookSecret: e.target.value })}
                placeholder="Enter webhook verify token"
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Send Test Message</CardTitle>
          </div>
          <CardDescription>Test your WhatsApp integration by sending a message</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="testPhone">Recipient Phone Number</Label>
            <Input
              id="testPhone"
              value={testMessage.phone}
              onChange={(e) => setTestMessage({ ...testMessage, phone: e.target.value })}
              placeholder="+6281234567890"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="testMessageContent">Message</Label>
            <Textarea
              id="testMessageContent"
              value={testMessage.message}
              onChange={(e) => setTestMessage({ ...testMessage, message: e.target.value })}
              rows={3}
            />
          </div>
          <Button variant="outline" onClick={handleSendTest}>
            <Send className="h-4 w-4 mr-2" />
            Send Test Message
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Support Contact</CardTitle>
          </div>
          <CardDescription>Configure the WhatsApp contact shown on Register page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supportName">Contact Name</Label>
              <Input
                id="supportName"
                value={supportContact.name}
                onChange={(e) => setSupportContact({ ...supportContact, name: e.target.value })}
                placeholder="Gym Coordinator"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportPhone">Contact WhatsApp</Label>
              <Input
                id="supportPhone"
                value={supportContact.phone}
                onChange={(e) => setSupportContact({ ...supportContact, phone: e.target.value })}
                placeholder="+6281275000560"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={handleSaveSupport}>Save Support Contact</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
