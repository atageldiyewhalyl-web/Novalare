import { useState } from 'react';
import { Mail, Paperclip, CheckCircle2, Clock, Upload, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Email, Company } from '@/utils/api-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface EmailInboxProps {
  emails: Email[];
  companyId: string;
  companyEmail?: string; // Optional company-specific email address
  onSendEmail: (emailData: {
    from: string;
    subject: string;
    body: string;
    attachments: File[];
  }) => Promise<void>;
}

export function EmailInbox({ emails, companyId, companyEmail, onSendEmail }: EmailInboxProps) {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [formData, setFormData] = useState({
    from: '',
    subject: '',
    body: '',
  });
  const [attachments, setAttachments] = useState<File[]>([]);

  // Use company-specific email if provided, otherwise fall back to template
  const forwardingEmail = companyEmail || `invoices+${companyId}@novalare.com`;

  const handleSendEmail = async () => {
    if (!formData.from || !formData.subject || attachments.length === 0) {
      alert('Please fill in all required fields and attach at least one invoice');
      return;
    }

    setIsSending(true);
    try {
      console.log('📧 Sending test email with attachments:', attachments.map(f => f.name));
      await onSendEmail({
        ...formData,
        attachments,
      });
      
      console.log('✅ Test email processed successfully');
      
      // Reset form
      setFormData({ from: '', subject: '', body: '' });
      setAttachments([]);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      alert('Failed to process email. Please check the console for details.');
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      // Try modern Clipboard API first
      await navigator.clipboard.writeText(text);
      alert('Email address copied!');
    } catch (err) {
      // Fallback to older method
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          alert('Email address copied!');
        } else {
          alert('Copy failed. Please manually copy: ' + text);
        }
      } catch (err2) {
        alert('Copy failed. Please manually copy: ' + text);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Email forwarding info */}
      <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
              <Mail className="size-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900 mb-1">Automatic Invoice Processing via Email</h3>
              <p className="text-sm text-gray-600 mb-2">
                This company has a unique email address. Forward invoices here and our AI will automatically:
              </p>
              <ul className="text-sm text-gray-600 mb-3 space-y-1 ml-4">
                <li>• Extract invoice metadata (vendor, amounts, dates, etc.)</li>
                <li>• Store the original PDF/image file</li>
                <li>• Add it to the Invoice Extraction workflow</li>
              </ul>
              <div className="flex items-center gap-3">
                <code className="px-3 py-2 bg-white border border-purple-300 rounded text-sm text-purple-900 select-all">
                  {forwardingEmail}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  onClick={() => copyToClipboard(forwardingEmail)}
                >
                  Copy
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-9 gap-2 bg-purple-600 hover:bg-purple-700">
                      <Send className="size-4" />
                      Test Email Parser
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Send Test Email with Invoice</DialogTitle>
                      <DialogDescription>
                        Simulate forwarding an email with invoice attachments. The system will automatically:
                        (1) Extract invoice data using AI, (2) Store the file securely, (3) Add it to Invoice Extraction workflow.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="from">From Email *</Label>
                        <Input
                          id="from"
                          type="email"
                          placeholder="sender@example.com"
                          value={formData.from}
                          onChange={(e) => setFormData({ ...formData, from: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="subject">Subject *</Label>
                        <Input
                          id="subject"
                          placeholder="Invoice from Acme Corp"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="body">Message Body (optional)</Label>
                        <Textarea
                          id="body"
                          placeholder="Please find the attached invoice..."
                          value={formData.body}
                          onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                          className="mt-1.5 min-h-24"
                        />
                      </div>
                      <div>
                        <Label htmlFor="attachments">Attachments (PDF or Images) *</Label>
                        <div className="mt-1.5 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 hover:bg-purple-50/50 transition-colors">
                          <input
                            id="attachments"
                            type="file"
                            multiple
                            accept=".pdf,image/*"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <label htmlFor="attachments" className="cursor-pointer">
                            <Upload className="size-10 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-900 mb-1">
                              {attachments.length > 0
                                ? `${attachments.length} file(s) selected`
                                : 'Click to upload invoice files'}
                            </p>
                            <p className="text-xs text-gray-500">PDF or image files</p>
                          </label>
                        </div>
                        {attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {attachments.map((file, idx) => (
                              <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                                <Paperclip className="size-3" />
                                {file.name} ({(file.size / 1024).toFixed(1)} KB)
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                          disabled={isSending}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSendEmail}
                          disabled={isSending}
                          className="gap-2 bg-purple-600 hover:bg-purple-700"
                        >
                          {isSending ? (
                            <>
                              <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Send className="size-4" />
                              Send & Process
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email list */}
      <Card>
        <CardHeader>
          <CardTitle>Received Emails</CardTitle>
        </CardHeader>
        <CardContent>
          {emails.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="size-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No emails received yet</p>
              <p className="text-sm text-gray-500">
                Forward invoices to {forwardingEmail} to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedEmail(email)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="text-gray-900">{email.subject}</h4>
                        <Badge
                          variant="secondary"
                          className={
                            email.status === 'Processed'
                              ? 'bg-green-100 text-green-700'
                              : email.status === 'Failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }
                        >
                          {email.status === 'Processed' && <CheckCircle2 className="size-3 mr-1" />}
                          {email.status === 'Received' && <Clock className="size-3 mr-1" />}
                          {email.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">From: {email.from}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(email.receivedAt).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Paperclip className="size-4" />
                      {email.attachments.length} attachment{email.attachments.length !== 1 ? 's' : ''}
                    </div>
                    {email.extractedInvoices > 0 && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="size-4" />
                        {email.extractedInvoices} invoice{email.extractedInvoices !== 1 ? 's' : ''} extracted
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email detail dialog */}
      {selectedEmail && (
        <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedEmail.subject}</DialogTitle>
              <DialogDescription>
                Email received on {new Date(selectedEmail.receivedAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <p className="text-sm text-gray-600">
                  <span className="text-gray-900">From:</span> {selectedEmail.from}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="text-gray-900">Received:</span>{' '}
                  {new Date(selectedEmail.receivedAt).toLocaleString()}
                </p>
              </div>
              
              {selectedEmail.body && (
                <div>
                  <h4 className="text-gray-900 mb-2">Message</h4>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedEmail.body}
                  </div>
                </div>
              )}
              
              <div>
                <h4 className="text-gray-900 mb-2">
                  Attachments ({selectedEmail.attachments.length})
                </h4>
                <div className="space-y-2">
                  {selectedEmail.attachments.map((attachment, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Paperclip className="size-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-900">{attachment.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {(attachment.fileSize / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(attachment.fileUrl, '_blank')}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
              {(selectedEmail.extractedInvoices > 0 || selectedEmail.extractedReceipts > 0) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="size-5 text-green-700 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-green-900 mb-1">
                        Successfully extracted {selectedEmail.extractedInvoices || 0} invoice
                        {selectedEmail.extractedInvoices !== 1 ? 's' : ''} and {selectedEmail.extractedReceipts || 0} receipt
                        {selectedEmail.extractedReceipts !== 1 ? 's' : ''} from this email
                      </p>
                      <p className="text-sm text-green-700">
                        ✓ {selectedEmail.extractedInvoices > 0 && 'Invoice metadata extracted with AI'}{selectedEmail.extractedInvoices > 0 && selectedEmail.extractedReceipts > 0 && ' | '}
                        {selectedEmail.extractedReceipts > 0 && 'Receipt data extracted with AI'}<br />
                        ✓ Original files stored securely<br />
                        ✓ Ready for review in {selectedEmail.extractedInvoices > 0 && 'Invoice Extraction'}{selectedEmail.extractedInvoices > 0 && selectedEmail.extractedReceipts > 0 && ' and '}
                        {selectedEmail.extractedReceipts > 0 && 'Receipt Extraction'} workflow
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {selectedEmail.extractedInvoices === 0 && selectedEmail.attachments.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Mail className="size-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-yellow-900 mb-1">Files received but no invoices extracted</p>
                      <p className="text-sm text-yellow-700">
                        This might happen if attachments are not invoices or are in an unsupported format. 
                        Supported formats: PDF, PNG, JPG, JPEG.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}