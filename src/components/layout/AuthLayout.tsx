
import { useSecureAuth } from '@/contexts/SecureAuthContext';
import { Navigate, Outlet } from 'react-router-dom';
import { UserNav } from './UserNav';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function AuthLayout() {
  const { session, isLoading } = useSecureAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-gray-900">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }
  
  const showBackButton = location.pathname.startsWith('/packer/');

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b bg-white border-gray-200">
        <div className="container mx-auto flex h-16 items-center px-4 bg-white">
          <div className="mr-4 hidden md:flex">
            <Link to="/" className="mr-6 flex items-center space-x-2">
              <span className="hidden font-bold sm:inline-block text-gray-900">Freshness Checker</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <UserNav />
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 bg-white min-h-screen">
       {showBackButton && (
         <Button asChild variant="outline" size="sm" className="mb-4">
            <Link to="/packer"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link>
          </Button>
       )}
        <Outlet />
      </main>
    </div>
  );
}
