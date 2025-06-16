
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppleIcon } from '@/components/AppleIcon';
import { Leaf, Zap, Shield, Clock } from 'lucide-react';

export default function AuthPage() {
  const { session } = useAuth();
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
      toast({ title: 'Welcome back!', description: 'Successfully logged in to Zepto Packer' });
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

  if (session) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse animation-delay-200"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-teal-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-100"></div>
      </div>

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Zepto Branding Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <AppleIcon className="w-12 h-12 text-green-600 mr-3" />
            <h1 className="text-4xl font-bold text-gradient">Zepto</h1>
          </div>
          <p className="text-muted-foreground text-lg font-medium">Packer Dashboard</p>
          <p className="text-sm text-muted-foreground mt-1">Ensuring freshness, delivered fast</p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-2 gap-4 mb-8 animate-slide-in-right animate-delay-100">
          <div className="flex items-center space-x-2 p-3 bg-white/50 backdrop-blur-sm rounded-lg border border-green-100">
            <Leaf className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">Fresh Quality</span>
          </div>
          <div className="flex items-center space-x-2 p-3 bg-white/50 backdrop-blur-sm rounded-lg border border-orange-100">
            <Zap className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-700">Fast Delivery</span>
          </div>
          <div className="flex items-center space-x-2 p-3 bg-white/50 backdrop-blur-sm rounded-lg border border-blue-100">
            <Shield className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Quality Assured</span>
          </div>
          <div className="flex items-center space-x-2 p-3 bg-white/50 backdrop-blur-sm rounded-lg border border-purple-100">
            <Clock className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">Real-time Track</span>
          </div>
        </div>

        <Tabs defaultValue="login" className="w-full animate-slide-in-right animate-delay-200">
          <TabsList className="grid w-full grid-cols-2 bg-white/70 backdrop-blur-sm border border-green-100">
            <TabsTrigger value="login" className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white">
              Login
            </TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white">
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card className="border-0 shadow-fresh bg-white/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-slate-800">Welcome Back</CardTitle>
                <CardDescription className="text-slate-600">
                  Sign in to access your packer dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="your.email@zepto.com" 
                      required 
                      className="border-green-200 focus:border-green-400 focus:ring-green-400/20 bg-white/90"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                      className="border-green-200 focus:border-green-400 focus:ring-green-400/20 bg-white/90"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-primary hover:opacity-90 transition-opacity shadow-brand text-white font-semibold py-3" 
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

          <TabsContent value="signup">
            <Card className="border-0 shadow-fresh bg-white/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-slate-800">Join Zepto</CardTitle>
                <CardDescription className="text-slate-600">
                  Create your packer account to get started
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignUp} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-slate-700 font-medium">Email Address</Label>
                    <Input 
                      id="signup-email" 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="your.email@zepto.com" 
                      required 
                      className="border-green-200 focus:border-green-400 focus:ring-green-400/20 bg-white/90"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-slate-700 font-medium">Password</Label>
                    <Input 
                      id="signup-password" 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                      className="border-green-200 focus:border-green-400 focus:ring-green-400/20 bg-white/90"
                    />
                    <p className="text-xs text-slate-500">Password must be at least 6 characters</p>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-fresh hover:opacity-90 transition-opacity shadow-brand text-white font-semibold py-3" 
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
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            By signing in, you agree to Zepto's quality standards
          </p>
          <p className="text-xs text-slate-400 mt-1">
            © 2024 Zepto. Freshness delivered fast.
          </p>
        </div>
      </div>
    </div>
  );
}
