import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Loader2, Upload, FileText, Zap, Clock } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface CredentialStatus {
  GOOGLE_PROJECT_ID: string;
  GOOGLE_PROCESSOR_ID: string;
  GOOGLE_PROCESSOR_LOCATION: string;
  GOOGLE_APPLICATION_CREDENTIALS_JSON: string;
}

interface TestResult {
  fileName: string;
  fileSize: number;
  startTime: number;
  endTime: number;
  duration: number;
  transactionCount: number;
  success: boolean;
  error?: string;
}

export function GoogleAITester() {
  const [credentials, setCredentials] = useState<CredentialStatus | null>(null);
  const [isCheckingCredentials, setIsCheckingCredentials] = useState(false);
  const [isTestingUpload, setIsTestingUpload] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check credentials on mount
  useEffect(() => {
    checkCredentials();
  }, []);

  const checkCredentials = async () => {
    setIsCheckingCredentials(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/debug/google-credentials`
      );
      
      if (response.ok) {
        const data = await response.json();
        setCredentials(data);
      } else {
        toast.error('Failed to check credentials');
      }
    } catch (error) {
      console.error('Error checking credentials:', error);
      toast.error('Failed to check credentials');
    } finally {
      setIsCheckingCredentials(false);
    }
  };

  const areCredentialsSet = () => {
    if (!credentials) return false;
    return (
      !credentials.GOOGLE_PROJECT_ID.includes('NOT SET') &&
      !credentials.GOOGLE_PROCESSOR_ID.includes('NOT SET') &&
      !credentials.GOOGLE_PROCESSOR_LOCATION.includes('NOT SET') &&
      !credentials.GOOGLE_APPLICATION_CREDENTIALS_JSON.includes('NOT SET')
    );
  };

  const handleTestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }

    setIsTestingUpload(true);
    setTestResult(null);

    const startTime = Date.now();

    const formData = new FormData();
    formData.append('bank_file', file);
    formData.append('company_id', 'test-company');
    formData.append('period', '2024-01');
    formData.append('extraction_method', 'google'); // Use Google AI

    try {
      console.log('🚀 Starting Google AI test upload...');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/bank-rec/upload-bank-statement-stream`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Upload failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let transactionCount = 0;

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'transaction') {
              transactionCount++;
            } else if (data.type === 'complete') {
              const endTime = Date.now();
              const duration = endTime - startTime;

              setTestResult({
                fileName: file.name,
                fileSize: file.size,
                startTime,
                endTime,
                duration,
                transactionCount: data.transactionCount,
                success: true,
              });

              toast.success(`✅ Success! Extracted ${data.transactionCount} transactions in ${(duration / 1000).toFixed(2)}s`);
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          }
        }
      }
    } catch (error: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      setTestResult({
        fileName: file.name,
        fileSize: file.size,
        startTime,
        endTime,
        duration,
        transactionCount: 0,
        success: false,
        error: error.message,
      });

      toast.error(`❌ Failed: ${error.message}`);
    } finally {
      setIsTestingUpload(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Google Document AI Tester</h1>
        <p className="text-gray-600 mt-2">
          Test your Google Document AI integration for bank statement extraction
        </p>
      </div>

      {/* Credentials Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Credentials Status</span>
            <Button
              variant="outline"
              size="sm"
              onClick={checkCredentials}
              disabled={isCheckingCredentials}
            >
              {isCheckingCredentials ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                'Refresh'
              )}
            </Button>
          </CardTitle>
          <CardDescription>
            Verify that all Google Cloud credentials are configured
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!credentials && !isCheckingCredentials && (
            <Alert>
              <AlertDescription>
                Click "Refresh" to check credentials
              </AlertDescription>
            </Alert>
          )}

          {credentials && (
            <div className="space-y-3">
              <CredentialRow
                label="Project ID"
                value={credentials.GOOGLE_PROJECT_ID}
              />
              <CredentialRow
                label="Processor ID"
                value={credentials.GOOGLE_PROCESSOR_ID}
              />
              <CredentialRow
                label="Location"
                value={credentials.GOOGLE_PROCESSOR_LOCATION}
              />
              <CredentialRow
                label="Service Account JSON"
                value={credentials.GOOGLE_APPLICATION_CREDENTIALS_JSON}
              />
            </div>
          )}

          {credentials && !areCredentialsSet() && (
            <Alert className="bg-red-50 border-red-200">
              <XCircle className="size-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Missing Credentials!</strong> Set up Google Document AI credentials in Supabase:
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Go to Supabase Dashboard → Project Settings → Edge Functions</li>
                  <li>Click "Manage secrets"</li>
                  <li>Add these 4 secrets with your Google Cloud values</li>
                </ol>
              </AlertDescription>
            </Alert>
          )}

          {credentials && areCredentialsSet() && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="size-4 text-green-600" />
              <AlertDescription className="text-green-800">
                ✅ All credentials configured! Ready to test.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Test Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-5 text-blue-500" />
            Test Bank Statement Upload
          </CardTitle>
          <CardDescription>
            Upload a PDF bank statement to test Google Document AI extraction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleTestUpload}
              className="hidden"
              id="test-file-input"
            />
            <Button
              onClick={() => document.getElementById('test-file-input')?.click()}
              disabled={isTestingUpload || !areCredentialsSet()}
              className="gap-2"
            >
              {isTestingUpload ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Upload Test PDF
                </>
              )}
            </Button>
            {!areCredentialsSet() && (
              <span className="text-sm text-gray-500">
                Configure credentials first
              </span>
            )}
          </div>

          {testResult && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="size-4" />
                  Test Results
                </h3>
                {testResult.success ? (
                  <Badge className="bg-green-500">Success</Badge>
                ) : (
                  <Badge className="bg-red-500">Failed</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">File:</span>
                  <p className="font-medium">{testResult.fileName}</p>
                </div>
                <div>
                  <span className="text-gray-600">Size:</span>
                  <p className="font-medium">
                    {(testResult.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Duration:</span>
                  <p className="font-medium flex items-center gap-1">
                    <Clock className="size-3" />
                    {(testResult.duration / 1000).toFixed(2)}s
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Transactions:</span>
                  <p className="font-medium">{testResult.transactionCount}</p>
                </div>
              </div>

              {testResult.success && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="size-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    🎉 <strong>Extraction successful!</strong> Google Document AI processed your bank statement in {(testResult.duration / 1000).toFixed(2)} seconds.
                  </AlertDescription>
                </Alert>
              )}

              {!testResult.success && testResult.error && (
                <Alert className="bg-red-50 border-red-200">
                  <XCircle className="size-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Error:</strong> {testResult.error}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>📚 Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">1. Create Google Cloud Project</h4>
            <p className="text-sm text-gray-600">
              Go to <a href="https://console.cloud.google.com" target="_blank" className="text-blue-500 hover:underline">console.cloud.google.com</a> and create a new project
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">2. Enable Document AI API</h4>
            <p className="text-sm text-gray-600">
              Search for "Document AI API" and enable it for your project
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">3. Create Document Processor</h4>
            <p className="text-sm text-gray-600">
              Go to Document AI → Create Processor → Select "Form Parser" or "Document OCR"
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">4. Create Service Account</h4>
            <p className="text-sm text-gray-600">
              IAM & Admin → Service Accounts → Create account with "Document AI API User" role → Create JSON key
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-2">5. Add Secrets to Supabase</h4>
            <p className="text-sm text-gray-600 mb-2">
              In Supabase Dashboard → Project Settings → Edge Functions → Manage secrets, add:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-4">
              <li><code>GOOGLE_PROJECT_ID</code> - Your GCP project ID</li>
              <li><code>GOOGLE_PROCESSOR_ID</code> - The processor ID from step 3</li>
              <li><code>GOOGLE_PROCESSOR_LOCATION</code> - e.g., "us" or "eu"</li>
              <li><code>GOOGLE_APPLICATION_CREDENTIALS_JSON</code> - Full JSON key content</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  const isSet = !value.includes('NOT SET');
  
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {isSet ? (
          <>
            <CheckCircle className="size-4 text-green-500" />
            <span className="text-sm text-gray-600">{value}</span>
          </>
        ) : (
          <>
            <XCircle className="size-4 text-red-500" />
            <span className="text-sm text-red-600">Not Set</span>
          </>
        )}
      </div>
    </div>
  );
}