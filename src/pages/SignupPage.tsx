import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEO } from '@/components/SEO';
import { projectId, publicAnonKey } from '@/utils/supabase/info';
import { AlertCircle, CheckCircle2, Loader2, Mail, Sparkles, Rocket } from 'lucide-react';
import { ConsultationModal } from '@/components/ConsultationModal';
import backgroundImage from 'figma:asset/3566decf97819d8f45709aadc4171f2104fef8ba.png';
import logoImage from 'figma:asset/9bc1ddea66c99d1c9e5f8bdf63c06cc06ba53fa4.png';

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp, signIn } = useAuth();
  const [firmName, setFirmName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitationOnly, setInvitationOnly] = useState(false); // Toggle this to enable/disable public signup
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  // Get redirect URL from query params (for invitation flow)
  const redirectUrl = searchParams.get('redirect');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (invitationOnly) {
      setError('Signups are currently by invitation only. Please book a consultation first.');
      return;
    }

    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!agreeToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    setLoading(true);

    try {
      // Store redirect URL in localStorage if it exists (for post-email-verification redirect)
      if (redirectUrl) {
        localStorage.setItem('postVerificationRedirect', redirectUrl);
      }

      await signUp(email, password, fullName, firmName);

      // Show success message (Check your Email)
      setSignupSuccess(true);

    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
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

      if (response.ok) {
        alert('Verification email sent! Please check your inbox.');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to resend email');
      }
    } catch (err) {
      alert('Failed to resend email');
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden" style={{ backgroundColor: '#0a0a0f' }}>
      {/* SEO Meta Tags */}
      <SEO
        title="Sign Up - Novalare | Start Your Free Trial"
        description="Create your Novalare account and start your 14-day free trial. Automate invoice extraction, bank reconciliation, and accounting workflows for your firm."
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
        {/* Invitation-Only Notice */}
        {invitationOnly && (
          <div className="relative mb-6">
            {/* Glow effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 rounded-3xl opacity-50 blur-lg" />

            {/* Notice card */}
            <div className="relative bg-gradient-to-br from-amber-500/90 to-orange-500/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 text-center border border-amber-400/20">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Sparkles className="size-6 text-white" />
                <h2
                  className="text-white"
                  style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif",
                    letterSpacing: '-0.01em',
                  }}
                >
                  Invitation Only
                </h2>
              </div>
              <p
                className="text-white/95 mb-5"
                style={{
                  fontSize: '15px',
                  fontWeight: '500',
                  fontFamily: "'Manrope', sans-serif",
                  lineHeight: '1.6',
                }}
              >
                We're currently onboarding new firms through consultations only. This helps us ensure the best fit and setup for your accounting practice.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-orange-600 rounded-full hover:bg-gray-50 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl group"
                style={{
                  fontWeight: '700',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                <Rocket className="size-4 group-hover:rotate-12 transition-transform" />
                Book a Consultation
              </button>
            </div>
          </div>
        )}

        {/* Logo and Header */}
        <div className="text-center mb-8">
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
            Create Your Account
          </h1>
          <p
            className="text-gray-400"
            style={{
              fontSize: '16px',
              fontWeight: '500',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            Start your 30-day free trial today
          </p>
        </div>

        {/* Signup Card */}
        <div className="relative">
          {/* Card glow */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 rounded-3xl opacity-20 blur-lg" />

          {/* Card */}
          <div className="relative bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">
            {!signupSuccess ? (
              <form onSubmit={handleSubmit} className="space-y-5">
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
                    Firm Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="text"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    placeholder="Smith & Associates CPA"
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
                    Your Full Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Smith"
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
                    Email Address <span className="text-red-400">*</span>
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
                    Password <span className="text-red-400">*</span>
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
                  <p className="text-xs text-gray-500 mt-1.5">
                    Must be at least 8 characters
                  </p>
                </div>

                <div>
                  <label
                    className="block text-sm text-gray-300 mb-2"
                    style={{
                      fontWeight: '600',
                      fontFamily: "'Manrope', sans-serif",
                    }}
                  >
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className="h-12 bg-black/40 border-white/10 text-white placeholder:text-gray-500 focus:border-indigo-500/50 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    disabled={loading}
                    className="mt-1 w-4 h-4 rounded border-white/20 bg-black/40 text-indigo-600 focus:ring-indigo-500/20"
                  />
                  <label
                    htmlFor="terms"
                    className="text-sm text-gray-400"
                    style={{
                      fontWeight: '500',
                      fontFamily: "'Manrope', sans-serif",
                    }}
                  >
                    I agree to the{' '}
                    <a href="#" className="text-indigo-400 hover:text-indigo-300">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#" className="text-indigo-400 hover:text-indigo-300">
                      Privacy Policy
                    </a>
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 hover:from-indigo-500 hover:via-blue-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300"
                  style={{
                    fontWeight: '600',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4 mr-2" />
                      Start Free Trial
                    </>
                  )}
                </Button>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
                  <p
                    className="text-xs text-indigo-300 text-center"
                    style={{
                      fontWeight: '600',
                      fontFamily: "'Manrope', sans-serif",
                    }}
                  >
                    ✨ 30-day free trial • No credit card required • Cancel anytime
                  </p>
                </div>
              </form>
            ) : (
              <div className="text-center py-4">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center">
                  <Mail className="w-10 h-10 text-green-400" />
                </div>
                <h2
                  className="text-white mb-3"
                  style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    fontFamily: "'Outfit', sans-serif",
                    letterSpacing: '-0.02em',
                  }}
                >
                  Check Your Email
                </h2>
                <p
                  className="text-gray-400 mb-2"
                  style={{
                    fontSize: '15px',
                    fontWeight: '500',
                    fontFamily: "'Manrope', sans-serif",
                    lineHeight: '1.6',
                  }}
                >
                  We've sent a verification email to
                </p>
                <p
                  className="text-indigo-400 mb-6"
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    fontFamily: "'Manrope', sans-serif",
                  }}
                >
                  {email}
                </p>
                <p
                  className="text-gray-500 text-sm mb-8"
                  style={{
                    fontFamily: "'Manrope', sans-serif",
                    lineHeight: '1.6',
                  }}
                >
                  Click the verification link in the email to activate your account and start your 30-day free trial.
                </p>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-6">
                  <p
                    className="text-xs text-indigo-300 text-center"
                    style={{
                      fontWeight: '500',
                      fontFamily: "'Manrope', sans-serif",
                      lineHeight: '1.5',
                    }}
                  >
                    💡 Didn't receive the email? Check your spam folder or{' '}
                    <button
                      onClick={handleResendVerification}
                      disabled={resendingEmail}
                      className="underline hover:text-indigo-200 disabled:opacity-50"
                    >
                      {resendingEmail ? 'Sending...' : 'resend verification'}
                    </button>
                  </p>
                </div>

                <Button
                  onClick={() => navigate('/login')}
                  variant="outline"
                  className="w-full h-11 bg-white/[0.03] border-white/10 text-white hover:bg-white/[0.05]"
                  style={{
                    fontWeight: '600',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  Back to Login
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

      {/* Consultation Modal */}
      <ConsultationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}