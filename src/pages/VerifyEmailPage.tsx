import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Loader2, Mail } from 'lucide-react';
import { projectId } from '@/utils/supabase/info';
import { supabase } from '@/utils/supabase/client';
import { SEO } from '@/components/SEO';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    verifyEmail();
  }, []);

  const verifyEmail = async () => {
    try {
      // Get the token from URL hash (Supabase uses hash for auth)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      if (!accessToken || type !== 'signup') {
        setStatus('error');
        setErrorMessage('Invalid verification link. Please try signing up again.');
        return;
      }

      console.log('✅ Got access token from URL, completing verification...');

      // Complete the verification by creating firm and user data
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/auth/complete-verification`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to complete verification');
      }

      const data = await response.json();
      console.log('✅ Verification completed:', data);

      // Set the session in Supabase client
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: hashParams.get('refresh_token') || '',
      });

      if (sessionError) {
        throw sessionError;
      }

      setStatus('success');

      // Check for post-verification redirect (e.g., accepting a team invitation)
      const postVerificationRedirect = localStorage.getItem('postVerificationRedirect');
      if (postVerificationRedirect) {
        localStorage.removeItem('postVerificationRedirect');
        setTimeout(() => {
          navigate(postVerificationRedirect);
        }, 2000);
      } else {
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }

    } catch (error: any) {
      console.error('❌ Verification error:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to verify email. Please try again.');
    }
  };

  return (
    <div className="min-h-screen relative bg-black flex items-center justify-center p-6 overflow-hidden">
      {/* SEO Meta Tags */}
      <SEO 
        title="Verify Email - Novalare"
        description="Verify your email to activate your Novalare account"
        noindex={true}
      />
      
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(79, 70, 229, 0.4) 0%, transparent 70%)',
            animation: 'float 20s ease-in-out infinite',
          }}
        />
        <div 
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%)',
            animation: 'float 15s ease-in-out infinite reverse',
          }}
        />
      </div>

      {/* Verification Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/10 p-12 text-center">
          {status === 'verifying' && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
              </div>
              <h1 className="text-2xl text-white mb-3">Verifying your email...</h1>
              <p className="text-gray-400 text-sm">
                Please wait while we activate your account
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h1 className="text-2xl text-white mb-3">Email verified!</h1>
              <p className="text-gray-400 text-sm mb-6">
                Your account has been activated successfully
              </p>
              <p className="text-indigo-400 text-sm">
                Redirecting to dashboard...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <h1 className="text-2xl text-white mb-3">Verification failed</h1>
              <p className="text-gray-400 text-sm mb-6">
                {errorMessage}
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/signup')}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white h-11 rounded-xl"
                >
                  Back to Sign Up
                </Button>
                <Button
                  onClick={() => navigate('/login')}
                  variant="outline"
                  className="w-full bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] h-11 rounded-xl"
                >
                  Go to Login
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-20px) translateX(10px); }
        }
      `}</style>
    </div>
  );
}