import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isLoading: boolean; // Alias for loading
  rolesLoading: boolean; // New state to track role fetching
  userRole: string | null; // Primary role for the user
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
  const [rolesLoading, setRolesLoading] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const { toast } = useToast();

  // Simplified role fetching without internal rolesLoading management
  const fetchUserRoles = async (userId: string, retryCount = 0): Promise<string[]> => {
    const maxRetries = 1;
    const retryDelay = 1000;
    
    try {
      console.log(`Fetching user roles for user ${userId} (attempt ${retryCount + 1})...`);
      console.log('Current auth.uid():', (await supabase.auth.getUser()).data.user?.id);
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to fetch user roles: ${error.message}`);
      }

      const roles = data?.map(r => r.role) || [];
      console.log('User roles fetched successfully:', roles);
      return roles;
    } catch (error: any) {
      console.error(`Role fetch attempt ${retryCount + 1} failed:`, error);
      
      // Retry for network errors or temporary issues
      if (retryCount < maxRetries && (
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('503') ||
        error.message.includes('502')
      )) {
        console.log(`Retrying role fetch in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return fetchUserRoles(userId, retryCount + 1);
      }
      
      // Log security audit event for persistent role fetch failures
      if (retryCount >= maxRetries) {
        console.error('Role verification failed after retries', {
          userId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        toast({
          title: "Permission Check Failed",
          description: "Unable to verify user permissions. Some features may be limited.",
          variant: "destructive",
        });
      }
      
      return []; // Fail closed - no roles if we can't verify
    }
  };

  // Centralized auth state change handler with proper rolesLoading management
  const handleAuthStateChange = async (event: string, newSession: Session | null) => {
    try {
      console.log('Auth event:', event, { 
        hasUser: !!newSession?.user,
        timestamp: new Date().toISOString()
      });

      // Handle token refresh events - no role refetch needed
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully', {
          userId: newSession?.user?.id,
          timestamp: new Date().toISOString()
        });
        setSession(newSession);
        setUser(newSession?.user ?? null);
        // Don't refetch roles for token refresh - keep existing roles
        return;
      }

      if (event === 'TOKEN_REFRESH_FAILED') {
        console.error('Token refresh failed', {
          userId: user?.id,
          timestamp: new Date().toISOString()
        });
        
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please sign in again.",
          variant: "destructive",
        });
        
        // Clear auth state on token refresh failure
        setSession(null);
        setUser(null);
        setUserRoles([]);
        return;
      }

      // Update session and user for all other events
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        console.log('User authenticated, fetching roles...');
        // Set rolesLoading to true ONLY when we need to fetch roles
        setRolesLoading(true);
        
        try {
          // Simplified role fetching with single timeout
          const timeoutPromise = new Promise<string[]>((resolve) => {
            setTimeout(() => {
              console.warn('Role fetch timed out after 5 seconds');
              resolve([]);
            }, 5000);
          });

          const roles = await Promise.race([
            fetchUserRoles(newSession.user.id),
            timeoutPromise
          ]);
          
          setUserRoles(roles);
          
          console.log('User authenticated successfully', {
            userId: newSession.user.id,
            email: newSession.user.email,
            roles: roles,
            timestamp: new Date().toISOString()
          });
        } catch (error: any) {
          console.error('Error fetching user roles:', error);
          setUserRoles([]);
        } finally {
          // Always clear rolesLoading after role fetch attempt
          setRolesLoading(false);
        }
      } else {
        // No user - clear roles immediately
        setUserRoles([]);
        
        if (event === 'SIGNED_OUT') {
          console.log('User signed out', {
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error: any) {
      console.error('Critical auth state change error:', error);
      
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
      
      // Clear roles on any error
      setUserRoles([]);
    } finally {
      // Always clear loading and rolesLoading states
      setLoading(false);
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let initializationTimeout: NodeJS.Timeout;
    let rolesLoadingTimeout: NodeJS.Timeout;

    // Add 10-second timeout for auth initialization
    initializationTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth initialization timed out after 10 seconds');
        setLoading(false);
        setRolesLoading(false);
        toast({
          title: "Connection Issue",
          description: "Taking longer than expected. You may have limited access.",
          variant: "destructive",
        });
      }
    }, 10000);

    // Add safety net for rolesLoading - never let it stay true for more than 15 seconds
    rolesLoadingTimeout = setTimeout(() => {
      if (mounted && rolesLoading) {
        console.warn('Roles loading timed out after 15 seconds, forcing reset');
        setRolesLoading(false);
      }
    }, 15000);

    const initializeAuth = async () => {
      try {
        console.log('Initializing authentication...');
        
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: Session | null }, error: any }>((resolve) => {
          setTimeout(() => {
            console.warn('Session fetch timed out');
            resolve({ data: { session: null }, error: { message: 'Timeout' } });
          }, 8000);
        });

        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (error && error.message !== 'Timeout') {
          throw new Error(`Session initialization failed: ${error.message}`);
        }
        
        if (mounted) {
          await handleAuthStateChange('INITIAL_SESSION', session);
          clearTimeout(initializationTimeout);
        }
      } catch (error: any) {
        console.error('Auth initialization error:', error);
        
        if (mounted) {
          setLoading(false);
          setRolesLoading(false);
          clearTimeout(initializationTimeout);
          toast({
            title: "Startup Error",
            description: "Failed to initialize authentication. Please refresh the page.",
            variant: "destructive",
          });
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          await handleAuthStateChange(event, session);
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(initializationTimeout);
      clearTimeout(rolesLoadingTimeout);
      subscription.unsubscribe();
    };
  }, []); // Remove rolesLoading from dependency array

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
      setRolesLoading(false);
      
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

  // Derive primary user role (prioritize admin > packer > user)
  const userRole = userRoles.includes('admin') ? 'admin' : 
                   userRoles.includes('packer') ? 'packer' : 
                   userRoles.length > 0 ? userRoles[0] : null;

  const value: AuthContextType = {
    user,
    session,
    loading,
    isLoading: loading, // Alias for loading
    rolesLoading, // Export rolesLoading state
    userRole,
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
