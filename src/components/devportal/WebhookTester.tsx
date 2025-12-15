import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { toast } from 'sonner';
import { Upload, Send, Webhook } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

export function WebhookTester() {
  const [from, setFrom] = useState('vendor@example.com');
  const [to, setTo] = useState('invoices@mg.novalare.com');
  const [subject, setSubject] = useState('Invoice #12345');
  const [body, setBody] = useState('Please find the attached invoice for payment.');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/api/webhook/mailgun`;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleTestWebhook = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one PDF file');
      return;
    }

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('from', from);
      formData.append('To', to);
      formData.append('subject', subject);
      formData.append('body-plain', body);
      formData.append('timestamp', Math.floor(Date.now() / 1000).toString());

      // Add files as attachments
      files.forEach((file, index) => {
        formData.append(`attachment-${index + 1}`, file);
      });

      console.log('🚀 Sending webhook test to:', webhookUrl);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(`✅ Webhook processed! ${result.message}`);
        console.log('Webhook response:', result);
        
        // Reset form
        setFiles([]);
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        toast.error(`Failed: ${result.error || result.message || 'Unknown error'}`);
        console.error('Webhook error:', result);
      }
    } catch (error) {
      console.error('Webhook test error:', error);
      toast.error('Failed to send webhook test');
    } finally {
      setSending(false);
    }
  };

  const copyWebhookUrl = () => {
    // Fallback method for copying text when Clipboard API is blocked
    try {
      const textArea = document.createElement('textarea');
      textArea.value = webhookUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        toast.success('Webhook URL copied to clipboard!');
      } else {
        toast.error('Failed to copy. Please manually select and copy the URL.');
      }
    } catch (err) {
      console.error('Copy failed:', err);
      toast.error('Failed to copy. Please manually select and copy the URL.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-gray-900">Email Webhook Setup</h1>
        <p className="text-gray-500 mt-1">Configure Mailgun to automatically process invoices sent to <strong>invoices@mg.novalare.com</strong></p>
      </div>

      {/* Quick Setup Instructions */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="text-purple-900">🚀 Quick Setup (3 Steps)</CardTitle>
          <CardDescription className="text-purple-700">Get invoice processing via email working in 2 minutes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="font-bold text-purple-900">1.</span>
              <div>
                <p className="text-purple-900"><strong>Copy the webhook URL below</strong></p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-purple-900">2.</span>
              <div>
                <p className="text-purple-900">
                  <strong>Log in to Mailgun:</strong> <a href="https://app.mailgun.com" target="_blank" rel="noopener" className="underline">app.mailgun.com</a>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-purple-900">3.</span>
              <div>
                <p className="text-purple-900"><strong>Create a Route:</strong></p>
                <ul className="ml-4 mt-1 space-y-1 text-purple-800">
                  <li>• Go to <strong>Sending → Routes</strong></li>
                  <li>• Click <strong>Create Route</strong></li>
                  <li>• Match Recipient: <code className="bg-white px-1 rounded">*@mg.novalare.com</code></li>
                  <li>• Actions: Check <strong>"Forward"</strong></li>
                  <li>• URL: Paste the webhook URL from step 1</li>
                  <li>• Click <strong>Create Route</strong></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-white rounded border border-purple-200">
            <p className="text-sm text-purple-900">
              ✅ <strong>Done!</strong> Emails sent to <code className="bg-purple-100 px-1 rounded">invoices@mg.novalare.com</code> will automatically be processed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="size-5" />
            Webhook Endpoint
          </CardTitle>
          <CardDescription>Use this URL in Mailgun's webhook configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input 
              value={webhookUrl} 
              readOnly 
              className="font-mono text-sm"
            />
            <Button onClick={copyWebhookUrl} variant="outline">
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5" />
            Simulate Mailgun Webhook
          </CardTitle>
          <CardDescription>
            Upload invoice PDFs to test the automatic processing pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from">From Email</Label>
              <Input
                id="from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="vendor@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="to">To Email (Recipient)</Label>
              <Input
                id="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="invoices@mg.novalare.com"
              />
              <p className="text-xs text-gray-500">
                Use format: company-2@mg.novalare.com to route to specific company
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Invoice #12345"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Email Body</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Email message body..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-input">Attachments (PDF only)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file-input"
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              <Upload className="size-5 text-gray-400" />
            </div>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((file, index) => (
                  <div key={index} className="text-sm text-gray-600 flex items-center gap-2">
                    <div className="size-2 bg-green-500 rounded-full" />
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleTestWebhook} 
              disabled={sending || files.length === 0}
              className="gap-2"
            >
              {sending ? (
                <>
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Send Test Webhook
                </>
              )}
            </Button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">💡 How it works:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Select one or more PDF invoices</li>
              <li>Fill in the email details (or use defaults)</li>
              <li>Click "Send Test Webhook"</li>
              <li>The system will extract invoice data using OpenAI</li>
              <li>Check the Invoice Extraction page to see the results</li>
            </ol>
          </div>

          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h4 className="text-sm font-medium text-amber-900 mb-2">⚠️ Company Routing:</h4>
            <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
              <li><code className="bg-amber-100 px-1 py-0.5 rounded">company-1@domain.com</code> → Routes to Company ID: 1</li>
              <li><code className="bg-amber-100 px-1 py-0.5 rounded">invoices+acme@domain.com</code> → Routes to Company ID: acme</li>
              <li>Default: Company ID 1 if no pattern matches</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>📚 Setup Instructions</CardTitle>
          <CardDescription>How to configure Mailgun for automatic email processing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">1. Sign up for Mailgun</h4>
            <p className="text-gray-600">Create a free account at <a href="https://mailgun.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">mailgun.com</a></p>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-1">2. Configure Webhook</h4>
            <p className="text-gray-600">In Mailgun dashboard, go to Webhooks and add the endpoint URL shown above</p>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-1">3. Set up Email Route</h4>
            <p className="text-gray-600">Create a route to forward emails to your webhook endpoint</p>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-1">4. Test with Real Emails</h4>
            <p className="text-gray-600">Forward invoice emails to your Mailgun address (e.g., invoices@sandbox.mailgun.org)</p>
          </div>

          <div className="pt-2">
            <a 
              href="/EMAIL_WEBHOOK_SETUP.md" 
              target="_blank"
              className="text-blue-600 hover:underline font-medium"
            >
              📄 View Full Setup Guide →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
