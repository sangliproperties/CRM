import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Webhook, Facebook, Instagram, Globe, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface WebhookStatus {
  facebook: {
    configured: boolean;
    webhookUrl: string;
    verifyToken: string;
    accessToken: string;
    appId: string;
    appSecret: string;
  };
}

export default function Settings() {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Webhook status endpoint is disabled for now
  const { data: webhookStatus, isLoading } = useQuery<WebhookStatus>({
    queryKey: ['/api/webhooks/status'],
    enabled: false, // Disabled - integration not active
  });

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast({
      title: "Copied!",
      description: `${fieldName} copied to clipboard`,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage integrations and webhook configurations</p>
        </div>
      </div>

      {/* Notice: Integration disabled */}
      <Card className="border-yellow-500/50 bg-yellow-500/10">
        <CardContent className="p-4">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            <strong>Note:</strong> Facebook/Instagram integration is currently disabled and will be configured for future use.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading settings...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Facebook/Instagram Integration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Webhook className="h-6 w-6" />
                  <div>
                    <CardTitle>Facebook & Instagram Lead Ads</CardTitle>
                    <CardDescription>Automatically receive leads from Facebook and Instagram ad campaigns</CardDescription>
                  </div>
                </div>
                <Badge variant={webhookStatus?.facebook.configured ? "default" : "secondary"}>
                  {webhookStatus?.facebook.configured ? "Configured" : "Not Configured"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Webhook URL</label>
                  <div className="flex gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                      {webhookStatus?.facebook.webhookUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(webhookStatus?.facebook.webhookUrl || '', 'Webhook URL')}
                      data-testid="button-copy-webhook-url"
                    >
                      {copiedField === 'Webhook URL' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this URL in your Facebook App's webhook configuration
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">App ID</label>
                    <Badge variant="outline">{webhookStatus?.facebook.appId}</Badge>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">App Secret</label>
                    <Badge variant="outline">{webhookStatus?.facebook.appSecret}</Badge>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Verify Token</label>
                    <Badge variant="outline">{webhookStatus?.facebook.verifyToken}</Badge>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Access Token</label>
                    <Badge variant="outline">{webhookStatus?.facebook.accessToken}</Badge>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Facebook className="h-4 w-4" />
                  Setup Instructions
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Facebook Developers</a></li>
                  <li>Select your app and navigate to Webhooks in the left sidebar</li>
                  <li>Click "Add Subscription" for "Page"</li>
                  <li>Enter the Webhook URL from above</li>
                  <li>Enter your Verify Token (shown above)</li>
                  <li>Subscribe to <code className="bg-background px-1 rounded">leadgen</code> field</li>
                  <li>Connect your Facebook Page to the webhook</li>
                </ol>
              </div>

              <div className="rounded-lg bg-muted p-4 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Instagram className="h-4 w-4" />
                  Instagram Lead Ads
                </h4>
                <p className="text-sm text-muted-foreground">
                  Instagram lead ads will automatically work through your connected Facebook Page. Make sure your Instagram account is connected to your Facebook Business account.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Google & JustDial (Coming Soon) */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-6 w-6" />
                  <div>
                    <CardTitle>Google Ads & JustDial</CardTitle>
                    <CardDescription>Additional lead source integrations</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Google Ads and JustDial integrations are planned for future releases. Currently, you can manually add leads from these sources.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
