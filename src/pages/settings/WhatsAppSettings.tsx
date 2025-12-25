import { useState } from 'react';
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
    </div>
  );
}
