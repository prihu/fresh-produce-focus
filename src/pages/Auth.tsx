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
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isPasswordReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });

        if (error) throw error;

        toast.success('Password reset email sent! Please check your inbox.');
        setIsPasswordReset(false);
        setEmail('');
      } else if (isSignUp) {
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
      let errorMessage = 'An error occurred during authentication';
      
      // Enhanced error handling
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the confirmation link before signing in.';
      } else if (error.message.includes('Too many requests')) {
        errorMessage = 'Too many attempts. Please wait a moment before trying again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile-First Container */}
      <div className="min-h-screen">
        {/* Hero Section - Mobile First */}
        <div className="px-4 py-8 md:py-12 lg:py-16 bg-gradient-to-br from-fresh-50 via-white to-fresh-100/50">
          <div className="container mx-auto max-w-6xl">
            {/* Header */}
            <div className="text-center mb-12 md:mb-16 lg:mb-20 space-y-6 animate-fade-in-up">
              <div className="inline-flex items-center space-x-2 bg-fresh-100 text-fresh-700 px-4 py-2 rounded-full text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                <span>Zepto Quality Assurance</span>
              </div>
              
              <h1 className="text-heading-primary text-2xl md:text-4xl lg:text-5xl xl:text-6xl max-w-4xl mx-auto">
                Freshness Checker
                <span className="block text-fresh-600 mt-2">Dashboard</span>
              </h1>
              
              <p className="text-body-secondary text-base md:text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed">
                Ensuring the highest quality produce for our customers with AI-powered quality assurance
              </p>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
              
              {/* Features Section */}
              <div className="order-2 lg:order-1 space-y-8 animate-fade-in-up animation-delay-200">
                <div className="space-y-6">
                  <h2 className="text-heading-secondary text-xl md:text-2xl text-center lg:text-left">
                    Why Quality Matters
                  </h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6">
                    <div className="group p-6 bg-white rounded-2xl border border-subtle hover:border-fresh-200 hover:shadow-fresh transition-all duration-300">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-fresh-100 rounded-xl flex items-center justify-center group-hover:bg-fresh-200 transition-colors duration-300">
                          <Shield className="h-6 w-6 text-fresh-600" />
                        </div>
                        <div>
                          <h3 className="text-heading-tertiary text-lg font-semibold mb-2">Quality Assurance</h3>
                          <p className="text-body-secondary text-sm leading-relaxed">AI-powered freshness detection with manual verification ensures every item meets our standards</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="group p-6 bg-white rounded-2xl border border-subtle hover:border-quality-200 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-quality-100 rounded-xl flex items-center justify-center group-hover:bg-quality-200 transition-colors duration-300">
                          <Clock className="h-6 w-6 text-quality-600" />
                        </div>
                        <div>
                          <h3 className="text-heading-tertiary text-lg font-semibold mb-2">24x7 Operations</h3>
                          <p className="text-body-secondary text-sm leading-relaxed">Round-the-clock quality monitoring and packing ensures fresh deliveries anytime</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="group p-6 bg-white rounded-2xl border border-subtle hover:border-speed-200 hover:shadow-lg transition-all duration-300 sm:col-span-2 lg:col-span-1">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-speed-100 rounded-xl flex items-center justify-center group-hover:bg-speed-200 transition-colors duration-300">
                          <CheckCircle className="h-6 w-6 text-speed-600" />
                        </div>
                        <div>
                          <h3 className="text-heading-tertiary text-lg font-semibold mb-2">Proven Results</h3>
                          <p className="text-body-secondary text-sm leading-relaxed">Reducing refunds by 30% and improving customer satisfaction scores across all categories</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Auth Form Section */}
              <div className="order-1 lg:order-2 flex justify-center animate-fade-in-up animation-delay-100">
                <Card className="w-full max-w-md shadow-fresh-lg border-0 bg-white/80 backdrop-blur-sm">
                  <CardHeader className="text-center space-y-4 pb-6">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-fresh-500 to-fresh-600 rounded-2xl flex items-center justify-center mb-2">
                      <Shield className="h-8 w-8 text-white" />
                    </div>
                    
                    <CardTitle className="text-heading-primary text-xl md:text-2xl">
                      {isPasswordReset ? 'Reset Password' : isSignUp ? 'Join Our Team' : 'Welcome Back'}
                    </CardTitle>
                    
                    <CardDescription className="text-body-secondary text-sm md:text-base leading-relaxed">
                      {isPasswordReset 
                        ? 'Enter your email address and we\'ll send you a secure reset link'
                        : isSignUp 
                          ? 'Help us maintain the highest freshness standards for millions of customers' 
                          : 'Access your quality assurance dashboard and continue ensuring freshness'
                      }
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    <form onSubmit={handleAuth} className="space-y-5">
                      <div className="space-y-3">
                        <Label htmlFor="email" className="text-body-primary font-medium text-sm">
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={isLoading}
                          placeholder="Enter your work email"
                          className="h-12 px-4 text-base border-medium focus:border-fresh-300 focus:ring-2 focus:ring-fresh-100 transition-all duration-200"
                        />
                      </div>
                      
                      {!isPasswordReset && (
                        <div className="space-y-3">
                          <Label htmlFor="password" className="text-body-primary font-medium text-sm">
                            Password
                          </Label>
                          <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                            placeholder="Enter your password"
                            minLength={6}
                            className="h-12 px-4 text-base border-medium focus:border-fresh-300 focus:ring-2 focus:ring-fresh-100 transition-all duration-200"
                          />
                        </div>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-fresh-500 to-fresh-600 hover:from-fresh-600 hover:to-fresh-700 active:from-fresh-700 active:to-fresh-800 shadow-lg hover:shadow-fresh-lg transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200" 
                        disabled={isLoading || (isPasswordReset && !email.trim())}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            {isPasswordReset ? 'Sending Reset Email...' : isSignUp ? 'Creating Account...' : 'Signing In...'}
                          </>
                        ) : (
                          <>
                            {isPasswordReset ? (
                              <>Send Reset Email</>
                            ) : isSignUp ? (
                              <>Create Account</>
                            ) : (
                              <>Sign In to Dashboard</>
                            )}
                          </>
                        )}
                      </Button>
                    </form>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <Separator className="w-full" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-body-muted">or</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {!isPasswordReset && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full h-11 text-sm text-body-primary hover:text-fresh-600 hover:bg-fresh-50 transition-all duration-200"
                          onClick={() => setIsSignUp(!isSignUp)}
                          disabled={isLoading}
                        >
                          {isSignUp ? 'Already have an account? Sign in instead' : "Don't have an account? Sign up here"}
                        </Button>
                      )}
                      
                      {!isSignUp && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full h-11 text-sm text-body-secondary hover:text-body-primary hover:bg-gray-50 transition-all duration-200"
                          onClick={() => {
                            setIsPasswordReset(!isPasswordReset);
                            setPassword('');
                          }}
                          disabled={isLoading}
                        >
                          {isPasswordReset ? '← Back to Sign In' : 'Forgot your password?'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
