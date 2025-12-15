import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { SEO } from '@/components/SEO';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-black flex items-center justify-center p-6 overflow-hidden">
      {/* SEO Meta Tags */}
      <SEO 
        title="Login - Novalare | AI Accounting Platform"
        description="Sign in to Novalare to access your AI-powered accounting dashboard. Manage invoice extraction, bank reconciliation, and month-end close workflows."
        noindex={false}
      />
      
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large gradient orbs */}
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
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-10 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(67, 56, 202, 0.3) 0%, transparent 70%)',
            animation: 'pulse 10s ease-in-out infinite',
          }}
        />
        
        {/* Gradient mesh overlay */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(79, 70, 229, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(79, 70, 229, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-md w-full">
        {/* Logo and Header */}
        <div className="text-center mb-10">
          <button 
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-3 mb-6 group"
          >
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-blue-500 to-indigo-600 rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity" />
              
              {/* Icon container */}
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="17" cy="8" r="1.5" />
                  <circle cx="17" cy="16" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                  <circle cx="7" cy="16" r="1.5" />
                  <circle cx="7" cy="8" r="1.5" />
                </svg>
              </div>
            </div>
            
            <span 
              className="bg-gradient-to-r from-indigo-400 via-blue-400 to-indigo-500 bg-clip-text text-transparent group-hover:from-indigo-300 group-hover:via-blue-300 group-hover:to-indigo-400 transition-all"
              style={{
                fontSize: '32px',
                fontWeight: '800',
                fontFamily: "'Outfit', sans-serif",
                letterSpacing: '-0.02em',
              }}
            >
              Novalare
            </span>
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
                  onClick={() => navigate('/signup')}
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

      {/* Keyframes for animations */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-30px) translateX(30px);
          }
        }
      `}</style>
    </div>
  );
}