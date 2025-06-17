
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSecureAuth } from '@/contexts/SecureAuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppleIcon from '@/components/AppleIcon';
import { Leaf, Zap, Shield, Clock } from 'lucide-react';

export default function AuthPage() {
  const { user } = useSecureAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: 'Login Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Welcome back!', description: 'Successfully logged in to Freshness Checker' });
      navigate('/');
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
            emailRedirectTo: `${window.location.origin}/`
        }
    });
    if (error) {
      toast({ title: 'Sign Up Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Account Created!', description: 'Please check your email to verify your account.' });
    }
    setLoading(false);
  };

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements with proper z-index */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-fresh-200 to-fresh-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-subtle"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-fresh-100 to-fresh-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-subtle animate-delay-200"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-br from-fresh-100 to-fresh-100 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-pulse-subtle animate-delay-100"></div>
      </div>

      {/* Main content with proper z-index */}
      <div className="relative w-full max-w-md animate-fade-in-up z-10">
        {/* Branding Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <AppleIcon className="w-14 h-14 text-fresh-500 mr-3" />
            <h1 className="text-5xl font-bold text-gradient">Freshness Checker</h1>
          </div>
          <p className="text-heading-secondary text-xl font-semibold">Quality Dashboard</p>
          <p className="text-caption mt-2 text-slate-600">Ensuring freshness, delivered fast</p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-2 gap-3 mb-8 animate-slide-in-right animate-delay-100">
          <div className="flex items-center space-x-2 p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-quality-100 shadow-sm hover:shadow-fresh transition-all duration-300">
            <div className="p-2 bg-quality-100 rounded-lg">
              <Leaf className="w-4 h-4 text-quality-600" />
            </div>
            <span className="text-sm font-semibold text-quality-700">Fresh Quality</span>
          </div>
          <div className="flex items-center space-x-2 p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-speed-100 shadow-sm hover:shadow-fresh transition-all duration-300">
            <div className="p-2 bg-speed-100 rounded-lg">
              <Zap className="w-4 h-4 text-speed-600" />
            </div>
            <span className="text-sm font-semibold text-speed-700">Lightning Fast</span>
          </div>
          <div className="flex items-center space-x-2 p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-quality-100 shadow-sm hover:shadow-fresh transition-all duration-300">
            <div className="p-2 bg-quality-100 rounded-lg">
              <Shield className="w-4 h-4 text-quality-600" />
            </div>
            <span className="text-sm font-semibold text-quality-700">Quality Assured</span>
          </div>
          <div className="flex items-center space-x-2 p-4 bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm hover:shadow-fresh transition-all duration-300">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Clock className="w-4 h-4 text-slate-600" />
            </div>
            <span className="text-sm font-semibold text-slate-700">Real-time Track</span>
          </div>
        </div>

        {/* Tabs with proper z-index and visibility */}
        <Tabs defaultValue="login" className="w-full animate-slide-in-right animate-delay-200 relative z-20">
          <TabsList className="grid w-full grid-cols-2 bg-white/80 backdrop-blur-sm border border-quality-100 shadow-sm rounded-2xl p-1">
            <TabsTrigger 
              value="login" 
              className="tab-inactive data-[state=active]:bg-gradient-primary data-[state=active]:text-white data-[state=active]:shadow-fresh rounded-xl font-medium transition-all duration-300"
            >
              Login
            </TabsTrigger>
            <TabsTrigger 
              value="signup" 
              className="tab-inactive data-[state=active]:bg-gradient-primary data-[state=active]:text-white data-[state=active]:shadow-fresh rounded-xl font-medium transition-all duration-300"
            >
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-6 relative z-30">
            <Card className="border-0 shadow-fresh-lg bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden">
              <CardHeader className="text-center pb-6 bg-gradient-to-br from-quality-50 to-transparent">
                <CardTitle className="text-2xl text-heading-primary">Welcome Back</CardTitle>
                <CardDescription className="text-body-secondary">
                  Sign in to access your dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-heading-tertiary font-medium">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="your.email@freshnesschecker.com" 
                      required 
                      className="border-quality-200 focus:border-quality-400 focus:ring-quality-400/20 bg-white/90 rounded-xl h-12 text-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-heading-tertiary font-medium">Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                      className="border-quality-200 focus:border-quality-400 focus:ring-quality-400/20 bg-white/90 rounded-xl h-12 text-slate-700"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-primary hover:opacity-90 transition-all duration-300 shadow-fresh text-white font-semibold py-3 h-12 rounded-xl" 
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Signing in...
                      </div>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup" className="mt-6 relative z-30">
            <Card className="border-0 shadow-fresh-lg bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden">
              <CardHeader className="text-center pb-6 bg-gradient-to-br from-quality-50 to-transparent">
                <CardTitle className="text-2xl text-heading-primary">Join Freshness Checker</CardTitle>
                <CardDescription className="text-body-secondary">
                  Create your account to get started
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <form onSubmit={handleSignUp} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-heading-tertiary font-medium">Email Address</Label>
                    <Input 
                      id="signup-email" 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="your.email@freshnesschecker.com" 
                      required 
                      className="border-quality-200 focus:border-quality-400 focus:ring-quality-400/20 bg-white/90 rounded-xl h-12 text-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-heading-tertiary font-medium">Password</Label>
                    <Input 
                      id="signup-password" 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                      className="border-quality-200 focus:border-quality-400 focus:ring-quality-400/20 bg-white/90 rounded-xl h-12 text-slate-700"
                    />
                    <p className="text-micro text-slate-500">Password must be at least 6 characters</p>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-fresh hover:opacity-90 transition-all duration-300 shadow-fresh text-white font-semibold py-3 h-12 rounded-xl" 
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Creating account...
                      </div>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-8 text-center relative z-20">
          <p className="text-caption text-slate-600">
            By signing in, you agree to Freshness Checker's quality standards
          </p>
          <p className="text-micro mt-2 text-slate-500">
            © 2024 Freshness Checker. Freshness delivered fast.
          </p>
        </div>
      </div>
    </div>
  );
}
