import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '@/utils/supabase/info';

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

interface User {
  id: string;
  email: string;
  fullName: string;
  firmId: string;
  firmName: string;
  role: 'owner' | 'admin' | 'accountant' | 'viewer';
}

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
        loadUser(session.user.id);
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
        loadUser(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUser = async (userId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-53c2e113/auth/user/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else if (response.status === 404) {
        // User not found - this is expected for new features
        setUser(null);
      } else if (response.status === 503) {
        // Service unavailable - endpoint may not be implemented yet
        setUser(null);
      } else {
        // Other errors - silently handle
        setUser(null);
      }
    } catch (error) {
      // Silently handle - endpoint may not be implemented yet
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      await loadUser(data.user.id);
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
      throw new Error(error.error || 'Failed to sign up');
    }

    const result = await response.json();
    
    // Now sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      await loadUser(data.user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
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