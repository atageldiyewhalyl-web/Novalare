import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

export default function QBOCallback() {
  const [status, setStatus] = useState('Processing OAuth callback...');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const realmId = urlParams.get('realmId');
    const state = urlParams.get('state');
    const errorParam = urlParams.get('error');

    console.log('📥 QBO callback received:', { code: code ? 'present' : 'missing', realmId, state, error: errorParam });

    // Check for OAuth error
    if (errorParam) {
      console.error('❌ OAuth error:', errorParam);
      setError(`OAuth error: ${errorParam}`);
      notifyParent('qbo-oauth-error', { error: errorParam });
      setTimeout(() => window.close(), 3000);
      return;
    }

    // Validate required parameters
    if (!code || !realmId || !state) {
      console.error('❌ Missing required OAuth parameters');
      setError('Missing required OAuth parameters');
      notifyParent('qbo-oauth-error', { error: 'Missing required parameters' });
      setTimeout(() => window.close(), 3000);
      return;
    }

    try {
      // Forward to Edge Function with authentication
      setStatus('Exchanging tokens with QuickBooks...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/accounting/qbo/callback?code=${encodeURIComponent(code)}&realmId=${encodeURIComponent(realmId)}&state=${encodeURIComponent(state)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const text = await response.text();
      console.log('📨 Server response received, executing scripts...');

      // Replace document content with server response which contains postMessage script
      document.open();
      document.write(text);
      document.close();
      
    } catch (err: any) {
      console.error('❌ Callback processing error:', err);
      setError(`Failed to complete connection: ${err.message}`);
      notifyParent('qbo-oauth-error', { error: err.message });
      setTimeout(() => window.close(), 3000);
    }
  }

  function notifyParent(type: string, data: any) {
    if (window.opener) {
      window.opener.postMessage({ type, ...data }, '*');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        {!error ? (
          <>
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Connecting to QuickBooks...
            </h1>
            <p className="text-gray-600">{status}</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              Connection Failed
            </h1>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              This window will close automatically...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
