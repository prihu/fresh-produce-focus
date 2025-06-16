
import React from 'react';
import { useSecureAuth } from '@/contexts/SecureAuthContext';
import { Navigate } from 'react-router-dom';

const Index = () => {
  const { user, userRole, isLoading } = useSecureAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-fresh-500"></div>
      </div>
    );
  }

  // Redirect users based on their role
  if (user && userRole === 'packer') {
    return <Navigate to="/packer" replace />;
  }

  // For now, just show a simple dashboard
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome to Freshness Checker
        </h1>
        <p className="text-gray-600 mb-4">
          Your quality assurance dashboard
        </p>
        <p className="text-sm text-gray-500">
          Role: {userRole || 'Loading...'}
        </p>
      </div>
    </div>
  );
};

export default Index;
