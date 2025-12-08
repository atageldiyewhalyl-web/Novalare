import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

export function InitSetup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('halyl@novalare.com');
  const [password, setPassword] = useState('Halyl.A2025');
  const [fullName, setFullName] = useState('Halyl Atageldiyev');
  const [firmName, setFirmName] = useState('Novalare Team');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleInit = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/auth/init-default-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            fullName,
            firmName,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initialize account');
      }

      const result = await response.json();
      console.log('✅ Account initialized:', result);
      
      setSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      console.error('❌ Initialization error:', err);
      setError(err.message || 'Failed to initialize account. It may already exist.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl text-gray-900 mb-2">Account Created!</h1>
            <p className="text-gray-600 mb-4">
              Your account has been initialized and your existing company data has been migrated.
            </p>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-purple-900">
                <strong>Email:</strong> {email}<br />
                <strong>Firm:</strong> {firmName}<br />
                <strong>Company:</strong> Müller & Partner Steuerberatung ✅
              </p>
            </div>
            <p className="text-sm text-gray-500">
              Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="3" strokeWidth="2" />
                  <circle cx="12" cy="5" r="1.5" strokeWidth="2" />
                  <circle cx="17" cy="8" r="1.5" strokeWidth="2" />
                  <circle cx="17" cy="16" r="1.5" strokeWidth="2" />
                  <circle cx="12" cy="19" r="1.5" strokeWidth="2" />
                  <circle cx="7" cy="16" r="1.5" strokeWidth="2" />
                  <circle cx="7" cy="8" r="1.5" strokeWidth="2" />
                </svg>
              </div>
            </div>
            <span className="text-3xl text-white">Novalare</span>
          </div>
          <h1 className="text-2xl text-white mb-2">Initialize Your Account</h1>
          <p className="text-purple-200">One-time setup to migrate existing data</p>
        </div>

        {/* Setup Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>ℹ️ This will:</strong>
            </p>
            <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
              <li>Create your Supabase Auth account</li>
              <li>Create your firm record</li>
              <li>Migrate "Müller & Partner Steuerberatung" to your firm</li>
              <li>Preserve all existing workflows and data</li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mb-6">
              <AlertCircle className="size-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-900">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Your Full Name
              </label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Halyl Atageldiyev"
                disabled={loading}
                className="h-12"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="halyl@novalare.com"
                disabled={loading}
                className="h-12"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Halyl.A2025"
                disabled={loading}
                className="h-12"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Firm Name
              </label>
              <Input
                type="text"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="Novalare Team"
                disabled={loading}
                className="h-12"
              />
            </div>

            <Button
              onClick={handleInit}
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Initializing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 mr-2" />
                  Initialize Account
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Back to Homepage */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-purple-200 hover:text-white transition-colors"
          >
            ← Back to Homepage
          </button>
        </div>
      </div>
    </div>
  );
}
