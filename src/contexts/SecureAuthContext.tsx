
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { SecurityUtils } from '@/utils/security';

type UserRole = 'admin' | 'packer' | 'user';

interface SecureAuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole | null;
  isLoading: boolean;
  hasRole: (role: UserRole) => boolean;
  canAccessOrder: (packerId?: string) => boolean;
  signOut: () => Promise<void>;
}

const SecureAuthContext = createContext<SecureAuthContextType | undefined>(undefined);

export const useSecureAuth = () => {
  const context = useContext(SecureAuthContext);
  if (context === undefined) {
    throw new Error('useSecureAuth must be used within a SecureAuthProvider');
  }
  return context;
};

export const SecureAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async (userId: string): Promise<UserRole | null> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching user role:', SecurityUtils.formatSafeErrorMessage(error));
        return 'user'; // Default to 'user' role if no role is found
      }
      
      return data?.role as UserRole || 'user';
    } catch (error) {
      console.error('Error in fetchUserRole:', SecurityUtils.formatSafeErrorMessage(error));
      return 'user';
    }
  };

  // Role verification with polling for new users
  const verifyUserRoleWithRetry = async (userId: string, maxRetries: number = 5): Promise<UserRole | null> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const role = await fetchUserRole(userId);
      
      if (role && role !== 'user') {
        console.log(`Role verified for user ${userId}: ${role} (attempt ${attempt + 1})`);
        return role;
      }
      
      if (attempt < maxRetries - 1) {
        console.log(`Role not yet available, retrying in ${(attempt + 1) * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
      }
    }
    
    console.warn(`Role verification failed after ${maxRetries} attempts for user ${userId}`);
    return 'user'; // Default fallback
  };

  const hasRole = (role: UserRole): boolean => {
    if (!userRole) return false;
    
    // Admin has access to everything
    if (userRole === 'admin') return true;
    
    // Check specific role
    return userRole === role;
  };

  const canAccessOrder = (packerId?: string): boolean => {
    if (!user || !userRole) return false;
    
    // Admin can access any order
    if (userRole === 'admin') return true;
    
    // Packer can only access their own orders
    if (userRole === 'packer') {
      return packerId === user.id;
    }
    
    return false;
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear local state
      setUser(null);
      setSession(null);
      setUserRole(null);
    } catch (error) {
      console.error('Error signing out:', SecurityUtils.formatSafeErrorMessage(error));
      throw error;
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      if (!mounted) return;
      
      console.log('Auth state changed:', event, !!currentSession?.user);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        // For new signups, use retry mechanism to handle race conditions
        try {
          let role: UserRole | null;
          
          if (event === 'SIGNED_UP') {
            console.log('New signup detected, using retry mechanism for role verification');
            role = await verifyUserRoleWithRetry(currentSession.user.id);
          } else {
            // For existing users, use regular fetch
            role = await fetchUserRole(currentSession.user.id);
          }
          
          if (mounted) {
            console.log('User role set to:', role);
            setUserRole(role);
          }
        } catch (error) {
          console.error('Failed to fetch user role:', SecurityUtils.formatSafeErrorMessage(error));
          if (mounted) {
            setUserRole('user'); // Default fallback
          }
        }
      } else {
        setUserRole(null);
      }
      
      if (mounted) {
        setIsLoading(false);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        handleAuthChange('INITIAL_SESSION', session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: SecureAuthContextType = {
    user,
    session,
    userRole,
    isLoading,
    hasRole,
    canAccessOrder,
    signOut
  };

  return (
    <SecureAuthContext.Provider value={value}>
      {children}
    </SecureAuthContext.Provider>
  );
};
