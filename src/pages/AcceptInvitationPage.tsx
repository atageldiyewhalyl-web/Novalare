import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Users } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';

export function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [firmName, setFirmName] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid invitation link');
      return;
    }

    // If user is not logged in, redirect to login with return URL
    if (!user || !session) {
      navigate(`/login?redirect=/accept-invitation?token=${token}`);
      return;
    }

    acceptInvitation();
  }, [token, user, session]);

  const acceptInvitation = async () => {
    if (!token || !session?.access_token) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/team/accept-invitation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ token })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus('error');
        setMessage(data.error || 'Failed to accept invitation');
        return;
      }

      setStatus('success');
      setMessage(data.message);
      setFirmName(data.firmName);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setStatus('error');
      setMessage('Failed to accept invitation. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            {status === 'loading' && (
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            )}
            {status === 'error' && (
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="text-center">
            {status === 'loading' && (
              <>
                <h2 className="text-2xl text-white mb-2">Accepting Invitation...</h2>
                <p className="text-gray-400">Please wait while we add you to the team</p>
              </>
            )}

            {status === 'success' && (
              <>
                <h2 className="text-2xl text-white mb-2">Welcome to the Team!</h2>
                <p className="text-gray-400 mb-4">
                  You've successfully joined <span className="text-purple-400 font-medium">{firmName}</span>
                </p>
                <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
              </>
            )}

            {status === 'error' && (
              <>
                <h2 className="text-2xl text-white mb-2">Invitation Error</h2>
                <p className="text-gray-400 mb-6">{message}</p>
                <div className="space-y-3">
                  <Button
                    onClick={() => navigate('/dashboard')}
                    className="w-full"
                  >
                    Go to Dashboard
                  </Button>
                  <Button
                    onClick={() => navigate(`/login?redirect=/accept-invitation?token=${token}`)}
                    variant="outline"
                    className="w-full"
                  >
                    Sign In
                  </Button>
                  <Button
                    onClick={() => navigate(`/signup?redirect=/accept-invitation?token=${token}`)}
                    variant="outline"
                    className="w-full"
                  >
                    Create Account
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {status !== 'error' && (
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Users className="w-4 h-4" />
                <span>Powered by Novalare</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}