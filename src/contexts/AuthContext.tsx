import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { trackAuthEvent } from '@/utils/analytics';
import { clearSessionCache } from '@/utils/api-client';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, firmName: string) => Promise<void>;
  signOut: () => Promise<void>;
  session: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUser(session.user.id, session.access_token);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUser(session.user.id, session.access_token);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUser = async (userId: string, accessToken?: string) => {
    try {
      console.log('👤 Loading user data for ID:', userId);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/auth/user/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      console.log('📊 Load user response status:', response.status);

      if (response.ok) {
        const userData = await response.json();
        console.log('✅ User data loaded:', { id: userData.id, email: userData.email, firmId: userData.firmId });
        setUser(userData);
      } else if (response.status === 404) {
        // User not found in database - try to complete verification automatically
        console.warn('⚠️ User not found in database - attempting to complete setup...');
        
        if (accessToken) {
          // Try to complete verification with the access token
          try {
            console.log('🔧 Attempting to complete verification automatically...');
            const completeResponse = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/auth/complete-verification`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (completeResponse.ok) {
              console.log('✅ Account setup completed automatically, retrying user load...');
              // Retry loading user data
              const retryResponse = await fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/auth/user/${userId}`,
                {
                  headers: {
                    'Authorization': `Bearer ${publicAnonKey}`,
                  },
                }
              );

              if (retryResponse.ok) {
                const userData = await retryResponse.json();
                console.log('✅ User data loaded after auto-setup:', { id: userData.id, email: userData.email });
                setUser(userData);
                return; // Success!
              }
            } else {
              const errorData = await completeResponse.json();
              console.error('❌ Failed to complete verification:', errorData);
            }
          } catch (setupError) {
            console.error('❌ Error during automatic setup:', setupError);
          }
        }
        
        // If we get here, automatic setup failed
        await supabase.auth.signOut();
        setUser(null);
        throw new Error('Account setup incomplete. Please verify your email address or contact support if you already verified it.');
      } else if (response.status === 503) {
        // Service unavailable - server may be restarting or deploying
        // This is common with Supabase Edge Functions and usually resolves quickly
        console.log('⏳ Service temporarily starting up, will retry...');
        setUser(null);
        setLoading(false);
        
        // Retry after a brief delay
        setTimeout(() => {
          checkSession();
        }, 2000);
        return; // Don't throw error, let app continue
      } else {
        // Other errors
        console.error('❌ Error loading user, status:', response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        setUser(null);
        setLoading(false);
        return; // Don't throw error, let app continue
      }
    } catch (error: any) {
      console.error('❌ Error in loadUser:', error);
      
      // If it's a network error (not an Error we threw), handle gracefully
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        console.error('Network error - server may be unavailable');
        // Don't sign out the user, just set loading to false
        // This allows the app to continue working if it's a temporary network issue
        setUser(null);
        setLoading(false);
        return; // Don't re-throw network errors
      }
      
      setUser(null);
      // Re-throw the error so it can be caught by signIn
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const checkSession = () => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUser(session.user.id, session.access_token);
      } else {
        setUser(null);
        setLoading(false);
      }
    });
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Attempting sign in for:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('📊 Sign in response:', { 
      hasUser: !!data?.user, 
      hasSession: !!data?.session,
      error: error?.message,
      userConfirmed: data?.user?.email_confirmed_at 
    });

    if (error) {
      console.error('❌ Sign in error:', error);
      
      // Track failed login
      await trackAuthEvent({
        eventType: 'login',
        email,
        success: false,
        errorMessage: error.message,
      });
      
      // Provide more user-friendly error messages
      if (error.message?.includes('Email not confirmed') || error.message?.includes('email_not_confirmed')) {
        throw new Error('Please verify your email address before logging in. Check your inbox for the verification email.');
      } else if (error.message?.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password. Please try again.');
      } else if (error.message?.includes('Email link is invalid')) {
        throw new Error('The email verification link has expired. Please request a new one.');
      }
      
      throw error;
    }

    // Check if user exists but email is not confirmed
    if (data.user && !data.user.email_confirmed_at) {
      console.warn('⚠️ User email not confirmed:', email);
      
      // Track failed login due to unconfirmed email
      await trackAuthEvent({
        eventType: 'login',
        email,
        success: false,
        errorMessage: 'Email not confirmed',
      });
      
      // Sign out the user since they shouldn't be logged in
      await supabase.auth.signOut();
      
      throw new Error('Please verify your email address before logging in. Check your inbox for the verification email.');
    }

    // Check if session was created
    if (!data.session) {
      console.error('❌ No session created');
      
      await trackAuthEvent({
        eventType: 'login',
        email,
        success: false,
        errorMessage: 'No session created',
      });
      
      throw new Error('Failed to create session. Please try again or contact support.');
    }

    if (data.user) {
      console.log('✅ Sign in successful, loading user data...');
      await loadUser(data.user.id, data.session?.access_token);
      
      // Track successful login
      await trackAuthEvent({
        eventType: 'login',
        userId: data.user.id,
        email,
        success: true,
      });
    }
  };

  const signUp = async (email: string, password: string, fullName: string, firmName: string) => {
    // First create the firm and user on the backend
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/auth/signup`,
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
      const error = await response.json();
      // Track failed signup
      await trackAuthEvent({
        eventType: 'signup',
        email,
        firmName,
        success: false,
        errorMessage: error.error || 'Failed to sign up',
      });
      throw new Error(error.error || 'Failed to sign up');
    }

    const result = await response.json();
    
    // Don't sign in - user must verify email first
    // The verification email has been sent by Supabase
    console.log('✅ Signup successful. Verification email sent to:', email);
    
    // Track signup initiated (will be completed after email verification)
    await trackAuthEvent({
      eventType: 'signup_initiated',
      userId: result.userId,
      email,
      firmName,
      success: true,
    });
  };

  const signOut = async () => {
    const currentUser = user;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    
    // Clear API client session cache for better performance
    clearSessionCache();
    
    // Track logout
    if (currentUser) {
      await trackAuthEvent({
        eventType: 'logout',
        userId: currentUser.id,
        email: currentUser.email,
        success: true,
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, session }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}