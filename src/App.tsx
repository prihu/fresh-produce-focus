
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SecureAuthProvider, useSecureAuth } from "@/contexts/SecureAuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Packer from "./pages/Packer";
import PackingStation from "./pages/PackingStation";
import NotFound from "./pages/NotFound";
import HealthCheck from "./pages/HealthCheck";

const queryClient = new QueryClient();

// Protected Route component with role-based access
const ProtectedRoute = ({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode;
  requiredRole?: 'admin' | 'packer' | 'user';
}) => {
  const { user, userRole, isLoading, hasRole } = useSecureAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-fresh-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to access this page.</p>
          <p className="text-sm text-gray-500 mt-2">Your role: {userRole || 'Unknown'}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Public Route component (redirects authenticated users to their dashboard)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, userRole, isLoading } = useSecureAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-fresh-500"></div>
      </div>
    );
  }

  // Redirect authenticated users to their appropriate dashboard
  if (user) {
    console.log('PublicRoute: Redirecting user with role:', userRole);
    // Default redirect to packer dashboard for all authenticated users
    // since this is primarily a packer application
    return <Navigate to="/packer" replace />;
  }

  return <>{children}</>;
};

// Smart Root Route that handles authenticated users properly
const RootRoute = () => {
  const { user, userRole, isLoading } = useSecureAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-fresh-500"></div>
      </div>
    );
  }

  // If user is authenticated, redirect based on their role
  if (user) {
    console.log('RootRoute: Authenticated user with role:', userRole);
    // For packers and admins, redirect to packer dashboard
    if (userRole === 'packer' || userRole === 'admin') {
      return <Navigate to="/packer" replace />;
    }
    // For other users, show the general dashboard
    return <Index />;
  }

  // If not authenticated, redirect to auth
  return <Navigate to="/auth" replace />;
};

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={<RootRoute />}
        />
        <Route 
          path="/auth" 
          element={
            <PublicRoute>
              <Auth />
            </PublicRoute>
          } 
        />
        <Route 
          path="/health-check" 
          element={<HealthCheck />} 
        />
        <Route 
          path="/packer" 
          element={
            <ProtectedRoute requiredRole="packer">
              <Packer />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/packer/:orderId" 
          element={
            <ProtectedRoute requiredRole="packer">
              <PackingStation />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SecureAuthProvider>
        <TooltipProvider>
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </SecureAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
