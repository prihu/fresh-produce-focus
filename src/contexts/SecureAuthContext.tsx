
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  hasRole: (role: string) => boolean;
  canAccessOrder: (packerIdFromOrder: string | null) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const SecureAuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const { toast } = useToast();

  // Enhanced role fetching with retry mechanism and better error handling
  const fetchUserRoles = async (userId: string, retryCount = 0): Promise<string[]> => {
    const maxRetries = 3;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to fetch user roles: ${error.message}`);
      }

      return data?.map(r => r.role) || [];
    } catch (error: any) {
      console.error(`Role fetch attempt ${retryCount + 1} failed:`, error);
      
      // For network errors or temporary issues, retry
      if (retryCount < maxRetries && (
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('503') ||
        error.message.includes('502')
      )) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchUserRoles(userId, retryCount + 1);
      }
      
      // Log security audit event for persistent role fetch failures
      if (retryCount >= maxRetries) {
        console.error('Critical: User role verification failed after all retries', {
          userId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        toast({
          title: "Authentication Issue",
          description: "Unable to verify user permissions. Please refresh the page.",
          variant: "destructive",
        });
      }
      
      return []; // Fail closed - no roles if we can't verify
    }
  };

  // Enhanced session handling with comprehensive error logging
  const handleAuthStateChange = async (event: string, newSession: Session | null) => {
    try {
      console.log('Auth event:', event, { 
        hasUser: !!newSession?.user,
        timestamp: new Date().toISOString()
      });

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Enhanced user role fetching with audit logging
        const roles = await fetchUserRoles(newSession.user.id);
        setUserRoles(roles);
        
        // Log successful authentication
        console.log('User authenticated successfully', {
          userId: newSession.user.id,
          email: newSession.user.email,
          roles: roles,
          timestamp: new Date().toISOString()
        });
      } else {
        setUserRoles([]);
        
        // Log sign-out events
        if (event === 'SIGNED_OUT') {
          console.log('User signed out', {
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error: any) {
      console.error('Critical auth state change error:', error);
      
      // Log authentication failures for security monitoring
      console.error('Authentication state change failed', {
        event,
        error: error.message,
        userId: newSession?.user?.id,
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: "Authentication Error",
        description: "There was an issue with authentication. Please try signing in again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session with enhanced error handling
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw new Error(`Session initialization failed: ${error.message}`);
        }
        
        if (mounted) {
          await handleAuthStateChange('INITIAL_SESSION', session);
        }
      } catch (error: any) {
        console.error('Auth initialization error:', error);
        
        if (mounted) {
          setLoading(false);
          toast({
            title: "Startup Error",
            description: "Failed to initialize authentication. Please refresh the page.",
            variant: "destructive",
          });
        }
      }
    };

    initializeAuth();

    // Enhanced auth state listener with error handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          await handleAuthStateChange(event, session);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Enhanced role checking with security logging
  const hasRole = (role: string): boolean => {
    const hasRoleResult = userRoles.includes(role);
    
    // Log role checks for admin actions for security monitoring
    if (role === 'admin') {
      console.log('Admin role check', {
        userId: user?.id,
        hasRole: hasRoleResult,
        timestamp: new Date().toISOString()
      });
    }
    
    return hasRoleResult;
  };

  // Enhanced order access validation
  const canAccessOrder = (packerIdFromOrder: string | null): boolean => {
    if (!user || !packerIdFromOrder) return false;
    
    const canAccess = user.id === packerIdFromOrder || hasRole('admin');
    
    // Log access attempts for security monitoring
    if (!canAccess) {
      console.warn('Unauthorized order access attempt', {
        userId: user.id,
        attemptedPackerId: packerIdFromOrder,
        timestamp: new Date().toISOString()
      });
    }
    
    return canAccess;
  };

  // Enhanced sign out with cleanup and logging
  const signOut = async (): Promise<void> => {
    try {
      console.log('Sign out initiated', {
        userId: user?.id,
        timestamp: new Date().toISOString()
      });
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw new Error(`Sign out failed: ${error.message}`);
      }
      
      // Clear local state
      setUser(null);
      setSession(null);
      setUserRoles([]);
      
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      
      toast({
        title: "Sign Out Failed",
        description: "There was an issue signing out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    hasRole,
    canAccessOrder,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useSecureAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSecureAuth must be used within a SecureAuthProvider');
  }
  return context;
};
