import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isLoading: boolean;
  rolesLoading: boolean;
  userRole: string | null;
  hasRole: (role: string) => boolean;
  canAccessOrder: (packerIdFromOrder: string | null) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const ROLE_FETCH_TIMEOUT_MS = 10000;

export const SecureAuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const { toast } = useToast();

  // Use ref to avoid stale closure in onAuthStateChange callback
  const rolesFetchedRef = useRef(false);

  const fetchUserRoles = async (userId: string): Promise<string[]> => {
    const fetchPromise = (async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Role fetch error:', error);
        throw error;
      }

      return data?.map(r => r.role) || [];
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Role fetch timed out after 10s')), ROLE_FETCH_TIMEOUT_MS)
    );

    return Promise.race([fetchPromise, timeoutPromise]);
  };

  useEffect(() => {
    let mounted = true;

    const handleAuthEvent = async (event: string, newSession: Session | null) => {
      if (!mounted) return;

      console.log('Auth event:', event, { hasUser: !!newSession?.user });

      // Token refresh — update session/user, keep roles
      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        return;
      }

      if (event === 'TOKEN_REFRESH_FAILED') {
        console.error('Token refresh failed');
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please sign in again.",
          variant: "destructive",
        });
        setSession(null);
        setUser(null);
        setUserRoles([]);
        rolesFetchedRef.current = false;
        setLoading(false);
        setRolesLoading(false);
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Only fetch roles once — ref is immune to stale closures
        if (!rolesFetchedRef.current) {
          console.log('Fetching roles for user:', newSession.user.id);
          setRolesLoading(true);
          try {
            const roles = await fetchUserRoles(newSession.user.id);
            if (mounted) {
              setUserRoles(roles);
              rolesFetchedRef.current = true;
              console.log('Roles fetched:', roles);
            }
          } catch (error: any) {
            console.error('Role fetch failed:', error.message);
            if (mounted) {
              setUserRoles([]);
              toast({
                title: "Permission Error",
                description: `Failed to load permissions: ${error.message}`,
                variant: "destructive",
              });
            }
          } finally {
            if (mounted) setRolesLoading(false);
          }
        }
      } else {
        // Signed out — clear everything
        setUserRoles([]);
        rolesFetchedRef.current = false;
      }

      if (mounted) setLoading(false);
    };

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        await handleAuthEvent('INITIAL_SESSION', session);
      } catch (error: any) {
        console.error('Auth init error:', error);
        if (mounted) {
          setLoading(false);
          setRolesLoading(false);
          toast({
            title: "Authentication Error",
            description: `Failed to initialize: ${error.message}`,
            variant: "destructive",
          });
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        handleAuthEvent(event, session);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const hasRole = (role: string): boolean => {
    return userRoles.includes(role);
  };

  const canAccessOrder = (packerIdFromOrder: string | null): boolean => {
    if (!user || !packerIdFromOrder) return false;
    return user.id === packerIdFromOrder || hasRole('admin');
  };

  const signOut = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setSession(null);
      setUserRoles([]);
      rolesFetchedRef.current = false;
      setRolesLoading(false);

      toast({ title: "Signed Out", description: "You have been successfully signed out." });
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign Out Failed",
        description: "There was an issue signing out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const userRole = userRoles.includes('admin') ? 'admin' :
                   userRoles.includes('packer') ? 'packer' :
                   userRoles.length > 0 ? userRoles[0] : null;

  const value: AuthContextType = {
    user, session, loading, isLoading: loading, rolesLoading,
    userRole, hasRole, canAccessOrder, signOut,
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
