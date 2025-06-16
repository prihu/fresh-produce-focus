
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';
import { UserNav } from './UserNav';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function AuthLayout() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }
  
  const showBackButton = location.pathname.startsWith('/packer/');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4">
          <div className="mr-4 hidden md:flex">
            <Link to="/" className="mr-6 flex items-center space-x-2">
              <span className="hidden font-bold sm:inline-block">Freshness Checker</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <UserNav />
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4">
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
