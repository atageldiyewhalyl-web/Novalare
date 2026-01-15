import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface DiagnosticResult {
  success: boolean;
  error?: string;
  accountId?: string;
  userArn?: string;
  region?: string;
  message?: string;
  details?: string;
  troubleshooting?: {
    accountVerification?: string;
    paymentMethods?: string;
    serviceQuotas?: string;
    support?: string;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme?: string;
}

export function AWSTextractTroubleshootingDialog({ open, onOpenChange, theme = 'light' }: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [showCLI, setShowCLI] = useState(false);

  const isDark = theme === 'premium-dark';

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResult(null);
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/aws-diagnostics`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );

      const data = await response.json();
      
      if (data.result) {
        setResult(data.result);
        
        if (data.result.success) {
          toast.success('AWS Textract is working!');
        } else {
          toast.warning('Textract activation issue detected - see details below');
        }
      }
    } catch (error: any) {
      toast.error('Failed to run diagnostics: ' + error.message);
      setResult({
        success: false,
        error: 'DIAGNOSTIC_FAILED',
        details: error.message
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getSupportTemplate = () => {
    if (!result) return '';
    
    return `Subject: Textract SubscriptionRequiredException with valid payment method

Account ID: ${result.accountId || '[From diagnostic output]'}
User ARN: ${result.userArn || '[From diagnostic output]'}
Region: ${result.region || 'us-east-1'}

I am getting SubscriptionRequiredException when calling the Textract API,
even though I have added a valid payment method to my account.

I have verified:
- Payment method is added and shows as "Verified"
- IAM user has AmazonTextractFullAccess policy attached
- Account email and phone are verified
- No warnings or alerts on billing dashboard

Please activate the Textract service on my account immediately.

Error details:
- API: AnalyzeDocument
- Feature: TABLES
- Error: SubscriptionRequiredException

Thank you!`;
  };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(getSupportTemplate());
      setCopiedTemplate(true);
      toast.success('Support template copied to clipboard!');
      setTimeout(() => setCopiedTemplate(false), 2000);
    } catch (error) {
      toast.error('Failed to copy template');
    }
  };

  const getErrorTitle = (error?: string) => {
    switch (error) {
      case 'SUBSCRIPTION_REQUIRED':
        return 'Textract Not Activated (Payment Issue)';
      case 'ACCESS_DENIED':
        return 'IAM Permissions Issue';
      case 'INVALID_CREDENTIALS':
        return 'Invalid AWS Credentials';
      case 'MISSING_CREDENTIALS':
        return 'AWS Credentials Not Set';
      default:
        return 'Unknown Issue';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-3xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-900 border-white/10 text-white' : 'bg-white'}`}>
        <DialogHeader>
          <DialogTitle className={isDark ? 'text-white' : ''}>
            AWS Textract Troubleshooting
          </DialogTitle>
          <DialogDescription className={isDark ? 'text-gray-400' : ''}>
            Diagnose why AWS Textract isn't working on your account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Run Diagnostics Button */}
          <div className="flex gap-3">
            <Button
              onClick={runDiagnostics}
              disabled={isRunning}
              className={isDark ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Running Diagnostics...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 size-4" />
                  Run AWS Diagnostics
                </>
              )}
            </Button>
            
            {result && (
              <div className="flex items-center gap-2 text-sm">
                {result.success ? (
                  <>
                    <CheckCircle className="size-4 text-green-500" />
                    <span className={isDark ? 'text-green-400' : 'text-green-700'}>Textract is working!</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-4 text-orange-500" />
                    <span className={isDark ? 'text-orange-400' : 'text-orange-700'}>Issue detected</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Diagnostic Results */}
          {result && (
            <div className="space-y-4">
              {/* Success State */}
              {result.success && (
                <Alert className={isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'}>
                  <CheckCircle className="size-4 text-green-500" />
                  <AlertDescription className={isDark ? 'text-green-300' : 'text-green-800'}>
                    <div className="space-y-2">
                      <p className="font-semibold">✅ AWS Textract is fully activated and working!</p>
                      <p>Your credentials are valid and Textract API calls are succeeding.</p>
                      <p className="text-sm mt-2">Next steps:</p>
                      <ul className="text-sm list-disc list-inside space-y-1">
                        <li>Try uploading a bank statement PDF</li>
                        <li>If upload fails, the issue is with the PDF format, not AWS</li>
                        <li>Check the error message for specific PDF issues</li>
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Error States */}
              {!result.success && result.error === 'SUBSCRIPTION_REQUIRED' && (
                <Alert className={isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'}>
                  <AlertCircle className="size-4 text-orange-500" />
                  <AlertDescription className={isDark ? 'text-orange-200' : 'text-orange-900'}>
                    <div className="space-y-4">
                      <div>
                        <p className="font-semibold text-lg mb-2">🚨 Textract Not Activated</p>
                        <p className="mb-3">You said: "I already added my payment information"</p>
                        <p className="mb-2">This error means AWS STILL doesn't see Textract as activated.</p>
                      </div>

                      {/* Account Details */}
                      {result.accountId && (
                        <div className={`p-3 rounded ${isDark ? 'bg-white/5' : 'bg-orange-100'}`}>
                          <p className="text-sm font-semibold mb-1">Your AWS Account:</p>
                          <p className="text-xs font-mono">Account ID: {result.accountId}</p>
                          <p className="text-xs font-mono">Region: {result.region}</p>
                        </div>
                      )}

                      <div className="space-y-3">
                        <p className="font-semibold">Common Reasons (even with payment):</p>
                        
                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="font-semibold">1️⃣ Account Verification Incomplete ⚠️ MOST COMMON</p>
                            <p className="ml-4 mt-1">AWS needs full verification beyond payment:</p>
                            <ul className="ml-8 list-disc space-y-1">
                              <li>Email verified?</li>
                              <li>Phone verified?</li>
                              <li>Identity verification complete?</li>
                            </ul>
                            <a
                              href="https://console.aws.amazon.com/billing/home#/account"
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`ml-4 mt-1 inline-flex items-center gap-1 ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                            >
                              Check Account Verification <ExternalLink className="size-3" />
                            </a>
                          </div>

                          <div>
                            <p className="font-semibold">2️⃣ Payment Method Not Actually Verified</p>
                            <p className="ml-4 mt-1">Adding ≠ Verified. Your bank may have:</p>
                            <ul className="ml-8 list-disc space-y-1">
                              <li>Blocked the $1 verification charge</li>
                              <li>Required 3D Secure authentication you didn't complete</li>
                              <li>Declined due to international rules</li>
                            </ul>
                            <a
                              href="https://console.aws.amazon.com/billing/home#/paymentmethods"
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`ml-4 mt-1 inline-flex items-center gap-1 ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                            >
                              Check Payment Methods <ExternalLink className="size-3" />
                            </a>
                          </div>

                          <div>
                            <p className="font-semibold">3️⃣ Account Too New (Activation Delay)</p>
                            <p className="ml-4 mt-1">New accounts take 12-48 hours to activate premium services.</p>
                            <p className="ml-4">When did you create this account?</p>
                            <ul className="ml-8 list-disc space-y-1">
                              <li>&lt; 24 hours ago? → WAIT 24 hours</li>
                              <li>24-48 hours ago? → Contact support</li>
                              <li>&gt; 48 hours ago? → Something is wrong, contact support</li>
                            </ul>
                          </div>

                          <div>
                            <p className="font-semibold">4️⃣ Service Quota Set to Zero</p>
                            <p className="ml-4 mt-1">New accounts may have Textract quota = 0</p>
                            <a
                              href="https://console.aws.amazon.com/servicequotas/home/services/textract/quotas"
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`ml-4 mt-1 inline-flex items-center gap-1 ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                            >
                              Check Service Quotas <ExternalLink className="size-3" />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <a
                          href="https://console.aws.amazon.com/billing/home#/account"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm inline-flex items-center gap-1"
                        >
                          1. Verify Account <ExternalLink className="size-3" />
                        </a>
                        <a
                          href="https://console.aws.amazon.com/billing/home#/paymentmethods"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm inline-flex items-center gap-1"
                        >
                          2. Check Payment <ExternalLink className="size-3" />
                        </a>
                        <a
                          href="https://console.aws.amazon.com/support/home"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm inline-flex items-center gap-1"
                        >
                          3. Contact AWS Support <ExternalLink className="size-3" />
                        </a>
                      </div>

                      {/* Support Template */}
                      <div className={`p-3 rounded ${isDark ? 'bg-white/5' : 'bg-orange-100'} space-y-2`}>
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm">📋 AWS Support Message Template</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyTemplate}
                            className={isDark ? 'bg-white/5 border-white/10' : ''}
                          >
                            {copiedTemplate ? (
                              <>
                                <Check className="mr-2 size-3" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="mr-2 size-3" />
                                Copy Template
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className={`text-xs p-2 rounded overflow-x-auto ${isDark ? 'bg-black/30' : 'bg-white'}`}>
                          {getSupportTemplate()}
                        </pre>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {!result.success && result.error === 'ACCESS_DENIED' && (
                <Alert className={isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}>
                  <AlertCircle className="size-4 text-red-500" />
                  <AlertDescription className={isDark ? 'text-red-200' : 'text-red-900'}>
                    <div className="space-y-3">
                      <p className="font-semibold">🚨 IAM Permissions Issue</p>
                      <p>Your IAM user lacks Textract permissions.</p>
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold">Fixes:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Add "AmazonTextractFullAccess" policy to your IAM user</li>
                          <li>Check for DENY policies that might block Textract</li>
                          <li>Verify your access key is for the correct IAM user</li>
                        </ol>
                      </div>
                      <a
                        href="https://console.aws.amazon.com/iam/home"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                      >
                        Open IAM Console <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Check Supabase Logs for Details */}
              <Alert className={isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}>
                <AlertCircle className="size-4 text-blue-500" />
                <AlertDescription className={isDark ? 'text-blue-200' : 'text-blue-900'}>
                  <p className="font-semibold mb-1">💡 More Details Available</p>
                  <p className="text-sm">
                    For complete diagnostic output, check your Supabase Dashboard → Logs → Edge Functions.
                    The logs contain detailed step-by-step analysis and troubleshooting recommendations.
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Initial Help Text */}
          {!result && !isRunning && (
            <div className="space-y-4">
              <Alert className={isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}>
                <AlertCircle className="size-4 text-blue-500" />
                <AlertDescription className={isDark ? 'text-blue-200' : 'text-blue-900'}>
                  <div className="space-y-2">
                    <p className="font-semibold">About AWS Textract Diagnostics</p>
                    <p className="text-sm">
                      This tool will check your AWS account configuration and identify why Textract isn't working.
                    </p>
                    <p className="text-sm">It will verify:</p>
                    <ul className="text-sm list-disc list-inside space-y-1">
                      <li>AWS credentials are valid</li>
                      <li>IAM user has correct permissions</li>
                      <li>Textract API is accessible</li>
                      <li>Service activation status</li>
                    </ul>
                    <p className="text-sm mt-2">
                      Click "Run AWS Diagnostics" to start the analysis.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <Alert className={isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'}>
                <AlertCircle className="size-4 text-orange-500" />
                <AlertDescription className={isDark ? 'text-orange-200' : 'text-orange-900'}>
                  <div className="space-y-2">
                    <p className="font-semibold">I Already Have Payment Information!</p>
                    <p className="text-sm">
                      Even with payment info, AWS requires:
                    </p>
                    <ul className="text-sm list-disc list-inside space-y-1">
                      <li>Full account verification (email + phone)</li>
                      <li>Payment method verification by your bank</li>
                      <li>12-48 hours activation time for new accounts</li>
                      <li>Service quotas &gt; 0</li>
                    </ul>
                    <p className="text-sm mt-2">
                      The diagnostics will tell you exactly what's missing.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Advanced Diagnostics - AWS CLI & boto3 */}
              <div className={`border rounded-lg ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                <button
                  onClick={() => setShowCLI(!showCLI)}
                  className={`w-full px-4 py-3 flex items-center justify-between text-left ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'} transition-colors rounded-lg`}
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="size-4" />
                    <span className="font-semibold">Advanced Diagnostics: AWS CLI & boto3</span>
                  </div>
                  {showCLI ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>

                {showCLI && (
                  <div className={`px-4 pb-4 space-y-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'} mt-2 pt-3`}>
                    <div className="space-y-3">
                      <p className="text-sm">Use these command-line tools for deeper diagnostics:</p>

                      {/* AWS CLI Section */}
                      <div className="space-y-2">
                        <p className="font-semibold text-sm">🔧 AWS CLI Commands</p>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs mb-1">1. Verify credentials work:</p>
                            <CopyableCommand
                              command="aws sts get-caller-identity"
                              isDark={isDark}
                            />
                          </div>
                          <div>
                            <p className="text-xs mb-1">2. Check Textract quota (MOST IMPORTANT!):</p>
                            <CopyableCommand
                              command="aws service-quotas get-service-quota --service-code textract --quota-code L-D4F7CA1B --region us-east-1"
                              isDark={isDark}
                            />
                            <p className="text-xs mt-1 opacity-75">Look for \"Value\": 1.0 or higher (0.0 = NOT activated)</p>
                          </div>
                          <div>
                            <p className="text-xs mb-1">3. Request quota increase (if quota = 0):</p>
                            <CopyableCommand
                              command="aws service-quotas request-service-quota-increase --service-code textract --quota-code L-D4F7CA1B --desired-value 1.0 --region us-east-1"
                              isDark={isDark}
                            />
                          </div>
                          <div>
                            <p className="text-xs mb-1">4. Check IAM permissions:</p>
                            <CopyableCommand
                              command="aws iam list-attached-user-policies --user-name novalare_textract_user"
                              isDark={isDark}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Python boto3 Section */}
                      <div className="space-y-2">
                        <p className="font-semibold text-sm">🐍 Python boto3 Diagnostics</p>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs mb-1">Run the diagnostic script from your Python server:</p>
                            <CopyableCommand
                              command={`cd python-extraction-server && python check_textract_quotas.py`}
                              isDark={isDark}
                            />
                          </div>
                          <div>
                            <p className="text-xs mb-1">Or call the API endpoint:</p>
                            <CopyableCommand
                              command="curl https://your-app.onrender.com/diagnose-aws-textract"
                              isDark={isDark}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quick Links */}
                      <div className="space-y-2 pt-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}">
                        <p className="font-semibold text-sm">📚 Full Documentation:</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className={`text-xs justify-start ${isDark ? 'bg-white/5 border-white/10' : ''}`}
                            onClick={() => {
                              toast.info('Check /AWS_CLI_DIAGNOSTICS.md in your project');
                            }}
                          >
                            <Terminal className="mr-2 size-3" />
                            AWS CLI Guide
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`text-xs justify-start ${isDark ? 'bg-white/5 border-white/10' : ''}`}
                            onClick={() => {
                              toast.info('Check /AWS_CLI_QUICK_COMMANDS.md in your project');
                            }}
                          >
                            <Terminal className="mr-2 size-3" />
                            Quick Commands
                          </Button>
                        </div>
                      </div>

                      <div className={`p-2 rounded text-xs ${isDark ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-900'}`}>
                        💡 <strong>Tip:</strong> The quota check is the fastest way to confirm if Textract is activated. 
                        If quota = 0, your account isn't activated yet regardless of payment status.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for copyable commands
function CopyableCommand({ command, isDark }: { command: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      toast.success('Command copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className={`flex items-start gap-2 ${isDark ? 'bg-black/30' : 'bg-white'} rounded p-2`}>
      <code className="text-xs flex-1 font-mono overflow-x-auto">{command}</code>
      <button
        onClick={copyCommand}
        className={`p-1 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} transition-colors flex-shrink-0`}
        title="Copy command"
      >
        {copied ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </div>
  );
}