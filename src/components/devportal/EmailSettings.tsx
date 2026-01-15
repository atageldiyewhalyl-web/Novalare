import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Copy, Check, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

interface EmailSettingsProps {
  companyId: string;
  companyName: string;
}

interface EmailConfig {
  forwardingEmail: string;
  invoicesProcessed: number;
  receiptsProcessed: number;
}

export function EmailSettings({ companyId, companyName }: EmailSettingsProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    forwardingEmail: '',
    invoicesProcessed: 0,
    receiptsProcessed: 0,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadEmailConfig();
  }, [companyId]);

  const loadEmailConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/email-settings`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-firm-id': 'default-firm-halyl',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load email settings');
      }

      const data = await response.json();
      setEmailConfig(data);
    } catch (error) {
      console.error('Error loading email settings:', error);
      toast.error('Failed to load email settings');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    // Use fallback method directly to avoid permissions errors
    copyToClipboardFallback(emailConfig.forwardingEmail);
  };

  // Fallback method for copying text when clipboard API is blocked
  const copyToClipboardFallback = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Email address copied to clipboard');
      } else {
        toast.error('Failed to copy email address');
      }
    } catch (err) {
      toast.error('Failed to copy email address');
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Are you sure you want to regenerate this email address? The old address will no longer work.')) {
      return;
    }

    try {
      setRegenerating(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/companies/${companyId}/email-settings/regenerate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
            'x-firm-id': 'default-firm-halyl',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to regenerate email');
      }

      const data = await response.json();
      setEmailConfig(prev => ({
        ...prev,
        forwardingEmail: data.email,
      }));
      toast.success('Email address regenerated successfully');
    } catch (error) {
      console.error('Error regenerating email:', error);
      toast.error('Failed to regenerate email');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className={`
          w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center
          ${theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-50'}
        `}>
          <RefreshCw className={`w-8 h-8 animate-spin ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
        </div>
        <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
          Loading email settings...
        </p>
      </div>
    );
  }

  const totalProcessed = emailConfig.invoicesProcessed + emailConfig.receiptsProcessed;

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className={`
        rounded-lg p-4 border flex items-start gap-3
        ${theme === 'dark' 
          ? 'bg-blue-500/10 border-blue-500/20' 
          : 'bg-blue-50 border-blue-200'
        }
      `}>
        <AlertCircle className={`w-5 h-5 flex-shrink-0 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
        <div>
          <h4 className={`font-medium mb-1 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-900'}`}>
            Automated Email Processing
          </h4>
          <p className={`text-sm ${theme === 'dark' ? 'text-blue-300/80' : 'text-blue-800'}`}>
            Forward receipts and invoices to these unique email addresses for automatic extraction and processing. Documents will be automatically categorized, extracted, and added to your company records.
          </p>
        </div>
      </div>

      {/* Single Forwarding Email */}
      <div className={`
        rounded-lg border p-6
        ${theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gray-50 border-gray-200'}
      `}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`
            w-12 h-12 rounded-lg flex items-center justify-center
            ${theme === 'dark' ? 'bg-[#65D3FD]/10' : 'bg-[#65D3FD]/10'}
          `}>
            <Mail className="w-6 h-6 text-[#65D3FD]" />
          </div>
          <div className="flex-1">
            <h3 className={`text-lg mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Forwarding Email
            </h3>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Forward both invoices and receipts to this address
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={emailConfig.forwardingEmail || ''}
              readOnly
              className={`
                font-mono text-sm
                ${theme === 'dark' 
                  ? 'bg-zinc-900 border-zinc-700 text-white' 
                  : 'bg-white border-gray-300'
                }
              `}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className={`flex-shrink-0 ${theme === 'dark' ? 'border-zinc-700 hover:bg-zinc-800' : ''}`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating}
              className={`flex-shrink-0 ${theme === 'dark' ? 'border-zinc-700 hover:bg-zinc-800' : ''}`}
            >
              <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* AI Classification Notice */}
          <div className={`
            flex items-start gap-2 p-3 rounded-lg text-sm
            ${theme === 'dark' ? 'bg-zinc-900/50 text-gray-400' : 'bg-white text-gray-600'}
          `}>
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              AI will automatically classify and sort documents into invoices and receipts
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className={`
              p-4 rounded-lg
              ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}
            `}>
              <div className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Total Processed
              </div>
              <div className={`text-2xl font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {totalProcessed}
              </div>
            </div>

            <div className={`
              p-4 rounded-lg
              ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}
            `}>
              <div className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Invoices
              </div>
              <div className={`text-2xl font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {emailConfig.invoicesProcessed}
              </div>
            </div>

            <div className={`
              p-4 rounded-lg
              ${theme === 'dark' ? 'bg-zinc-900' : 'bg-white'}
            `}>
              <div className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Receipts
              </div>
              <div className={`text-2xl font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {emailConfig.receiptsProcessed}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How Email Processing Works */}
      <div className={`
        rounded-lg border p-6
        ${theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gray-50 border-gray-200'}
      `}>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
          <h3 className={`text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            How Email Processing Works
          </h3>
        </div>
        
        <ol className={`space-y-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          <li className="flex items-start gap-3">
            <span className={`
              flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium
              ${theme === 'dark' ? 'bg-[#65D3FD]/20 text-[#65D3FD]' : 'bg-[#65D3FD]/20 text-[#65D3FD]'}
            `}>
              1
            </span>
            <div>
              <div className={`font-medium mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Forward Documents
              </div>
              <div>
                Email invoices and receipts to your forwarding address as attachments (PDF, JPG, PNG, or any image format)
              </div>
            </div>
          </li>
          
          <li className="flex items-start gap-3">
            <span className={`
              flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium
              ${theme === 'dark' ? 'bg-[#65D3FD]/20 text-[#65D3FD]' : 'bg-[#65D3FD]/20 text-[#65D3FD]'}
            `}>
              2
            </span>
            <div>
              <div className={`font-medium mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                AI Classification
              </div>
              <div>
                Our AI automatically determines if each document is an invoice or receipt based on format, content, and structure
              </div>
            </div>
          </li>
          
          <li className="flex items-start gap-3">
            <span className={`
              flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium
              ${theme === 'dark' ? 'bg-[#65D3FD]/20 text-[#65D3FD]' : 'bg-[#65D3FD]/20 text-[#65D3FD]'}
            `}>
              3
            </span>
            <div>
              <div className={`font-medium mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Data Extraction
              </div>
              <div>
                Key information is extracted: amounts, dates, vendors, merchant names, line items, taxes, and categories
              </div>
            </div>
          </li>
          
          <li className="flex items-start gap-3">
            <span className={`
              flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium
              ${theme === 'dark' ? 'bg-[#65D3FD]/20 text-[#65D3FD]' : 'bg-[#65D3FD]/20 text-[#65D3FD]'}
            `}>
              4
            </span>
            <div>
              <div className={`font-medium mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Ready for Review
              </div>
              <div>
                Documents are automatically sorted into "Invoice Extraction" or "Receipt Extraction" workflows for your review and approval
              </div>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}

export default EmailSettings;