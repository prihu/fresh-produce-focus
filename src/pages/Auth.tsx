import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Shield, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/packer`
          }
        });

        if (error) throw error;

        if (data.user) {
          toast.success('Account created successfully! Please check your email to confirm your account.');
          // Let the auth context handle navigation automatically
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast.success('Welcome back!');
        // Navigation will be handled by the auth context and routing
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.message || 'An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-fresh-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Value Proposition Section */}
        <div className="hidden lg:block space-y-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-gray-900">
              Zepto Freshness Checker
            </h1>
            <p className="text-xl text-gray-600">
              Ensuring the highest quality produce for our customers, 24x7
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-fresh-500" />
              <div>
                <h3 className="font-semibold text-gray-900">Reliable Quality Assurance</h3>
                <p className="text-gray-600">AI-powered freshness detection with manual verification</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Clock className="h-8 w-8 text-fresh-500" />
              <div>
                <h3 className="font-semibold text-gray-900">24x7 Operations</h3>
                <p className="text-gray-600">Round-the-clock quality monitoring and packing</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-8 w-8 text-fresh-500" />
              <div>
                <h3 className="font-semibold text-gray-900">Proven Results</h3>
                <p className="text-gray-600">Reducing refunds and improving customer satisfaction</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Form Section */}
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-gray-900">
              {isSignUp ? 'Join Our Team' : 'Welcome Back'}
            </CardTitle>
            <CardDescription>
              {isSignUp 
                ? 'Help us maintain the highest freshness standards' 
                : 'Sign in to your quality assurance dashboard'
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
    </div>
  );
};

export default Auth;
