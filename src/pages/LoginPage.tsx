import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2, Sparkles, Mail } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import backgroundImage from 'figma:asset/3566decf97819d8f45709aadc4171f2104fef8ba.png';
import logoImage from 'figma:asset/9bc1ddea66c99d1c9e5f8bdf63c06cc06ba53fa4.png';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);

  // Get redirect URL from query params
  const redirectUrl = searchParams.get('redirect');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setShowResendButton(false);

    console.log('🔐 Login form submitted for:', email);

    try {
      await signIn(email, password);
      console.log('✅ Sign in successful, redirecting...');
      // Redirect to the specified URL or dashboard
      navigate(redirectUrl || '/dashboard');
    } catch (err: any) {
      console.error('❌ Login error caught:', err);
      const errorMessage = err.message || 'Failed to sign in. Please check your credentials.';
      setError(errorMessage);
      
      // Show resend button if email is not verified or setup incomplete
      if (errorMessage.includes('verify your email') || errorMessage.includes('setup incomplete')) {
        setShowResendButton(true);
      }
      
      console.error('Login error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
    } finally {
      setLoading(false);
      console.log('🏁 Login attempt completed');
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setResendingEmail(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/auth/resend-verification`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resend verification email');
      }

      toast.success('Verification email sent! Please check your inbox.');
      setShowResendButton(false);
      setError('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend verification email');
    } finally {
      setResendingEmail(false);
    }
  };

  const checkUserStatus = async () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/auth/check-user-status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();
      console.log('📊 User Status:', data);
      
      if (!data.exists) {
        toast.error('User not found. Please sign up first.');
      } else if (!data.emailConfirmed) {
        toast.error('Email not verified. Please check your inbox or click "Resend Verification Email".');
        setShowResendButton(true);
      } else if (!data.hasDbRecord) {
        toast.error('Account setup incomplete. Attempting to complete setup on next login...');
      } else {
        toast.success('Account is fully set up! Try logging in with the correct password.');
      }
    } catch (err: any) {
      console.error('Error checking user status:', err);
      toast.error('Failed to check user status');
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden" style={{ backgroundColor: '#0a0a0f' }}>
      {/* SEO Meta Tags */}
      <SEO 
        title="Login - Novalare | AI Accounting Platform"
        description="Sign in to Novalare to access your AI-powered accounting dashboard. Manage invoice extraction, bank reconciliation, and month-end close workflows."
        noindex={false}
      />
      
      {/* Background Image */}
      <div 
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-md w-full">
        {/* Logo and Header */}
        <div className="text-center mb-10">
          <button 
            onClick={() => navigate('/')}
            className="inline-block mb-6 group"
          >
            <img src={logoImage} alt="Novalare" className="h-10 w-auto mx-auto" />
          </button>
          
          <h1 
            className="text-white mb-3"
            style={{
              fontSize: '28px',
              fontWeight: '700',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.02em',
            }}
          >
            Welcome Back
          </h1>
          <p 
            className="text-gray-400"
            style={{
              fontSize: '16px',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            Sign in to continue to your dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="relative">
          {/* Card glow */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 rounded-3xl opacity-20 blur-lg" />
          
          {/* Card */}
          <div className="relative bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="size-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                </div>
              )}

              <div>
                <label 
                  className="block text-sm text-gray-300 mb-2"
                  style={{
                    fontWeight: '600',
                    fontFamily: "'Manrope', sans-serif",
                  }}
                >
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  disabled={loading}
                  className="h-12 bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-indigo-500/50 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label 
                  className="block text-sm text-gray-300 mb-2"
                  style={{
                    fontWeight: '600',
                    fontFamily: "'Manrope', sans-serif",
                  }}
                >
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="h-12 bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-indigo-500/50 focus:ring-indigo-500/20"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="relative w-full h-12 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 hover:from-indigo-500 hover:via-blue-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300"
                style={{
                  fontWeight: '600',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p 
                className="text-sm text-gray-400"
                style={{
                  fontWeight: '500',
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                Don't have an account?{' '}
                <button
                  onClick={() => navigate(redirectUrl ? `/signup?redirect=${redirectUrl}` : '/signup')}
                  className="text-transparent bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text hover:from-indigo-300 hover:to-blue-300 transition-all"
                  style={{
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  Sign up
                </button>
              </p>
            </div>

            {showResendButton && (
              <div className="mt-4 text-center">
                <Button
                  onClick={handleResendVerification}
                  disabled={resendingEmail}
                  variant="outline"
                  className="w-full bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05] h-11 rounded-xl"
                  style={{
                    fontWeight: '600',
                    fontFamily: "'Manrope', sans-serif",
                  }}
                >
                  {resendingEmail ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Resending...
                    </>
                  ) : (
                    <>
                      <Mail className="size-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Debug: Check user status */}
            {error && (
              <div className="mt-4 text-center">
                <Button
                  onClick={checkUserStatus}
                  variant="ghost"
                  className="text-gray-400 hover:text-white text-xs"
                  type="button"
                >
                  🔍 Debug: Check Account Status
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Back to Homepage */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-400 hover:text-white transition-colors inline-flex items-center gap-2 group"
            style={{
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            <span className="group-hover:-translate-x-1 transition-transform inline-block">←</span>
            Back to Homepage
          </button>
        </div>
      </div>
    </div>
  );
}