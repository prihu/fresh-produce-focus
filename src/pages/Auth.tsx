
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRoleAssigning, setIsRoleAssigning] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          setSignupSuccess(true);
          setIsRoleAssigning(true);
          
          // Wait a moment for the trigger to complete role assignment
          setTimeout(async () => {
            try {
              // Check if role was assigned
              const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', data.user.id)
                .single();

              setIsRoleAssigning(false);
              
              if (roleData) {
                toast.success('Account created successfully! You can now start packing orders.');
                navigate('/packer');
              } else {
                toast.success('Account created! Please wait a moment while we set up your access...');
                // Retry after a short delay
                setTimeout(() => navigate('/packer'), 2000);
              }
            } catch (error) {
              setIsRoleAssigning(false);
              toast.success('Account created! Redirecting to your dashboard...');
              navigate('/packer');
            }
          }, 1500);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast.success('Welcome back!');
        navigate('/packer');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.message || 'An error occurred during authentication');
    } finally {
      if (!isSignUp || !signupSuccess) {
        setIsLoading(false);
      }
    }
  };

  if (signupSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              {isRoleAssigning ? (
                <Loader2 className="h-12 w-12 text-fresh-500 animate-spin" />
              ) : (
                <CheckCircle className="h-12 w-12 text-green-500" />
              )}
            </div>
            <CardTitle className="text-2xl text-gray-900">
              {isRoleAssigning ? 'Setting up your account...' : 'Welcome to Zepto Freshness!'}
            </CardTitle>
            <CardDescription>
              {isRoleAssigning 
                ? 'Please wait while we configure your packer access...' 
                : 'Your account has been created successfully. You can now start ensuring fresh produce quality for our customers!'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Next steps:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Access your packer dashboard</li>
                  <li>• Create and manage orders</li>
                  <li>• Capture photos for quality assurance</li>
                  <li>• Help maintain Zepto's freshness standards</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            {!isRoleAssigning && (
              <Button 
                onClick={() => navigate('/packer')} 
                className="w-full mt-4"
              >
                Go to Dashboard
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-gray-900">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </CardTitle>
          <CardDescription>
            {isSignUp 
              ? 'Join our team to ensure fresh produce quality' 
              : 'Welcome back to Freshness Checker'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                placeholder="Enter your email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                placeholder="Enter your password"
                minLength={6}
              />
            </div>
            
            {isSignUp && (
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                  By creating an account, you'll be assigned packer privileges to help maintain Zepto's quality standards.
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                isSignUp ? 'Create Account' : 'Sign In'
              )}
            </Button>
          </form>

          <Separator className="my-6" />

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setIsSignUp(!isSignUp)}
            disabled={isLoading}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
