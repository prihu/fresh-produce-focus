
import { useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSecureAuth } from "@/contexts/SecureAuthContext";
import { SecurityUtils } from "@/utils/security";
import PackingWorkflow from "@/components/packer/PackingWorkflow";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const PackingStation = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user, canAccessOrder, hasRole } = useSecureAuth();

  // Validate orderId parameter
  if (!orderId) {
    return <Navigate to="/packer" replace />;
  }

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['orderDetails', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!orderId && !!user,
    retry: (failureCount, error: any) => {
      // Don't retry on permission errors
      const message = SecurityUtils.formatSafeErrorMessage(error);
      if (message.includes('permission') || message.includes('access')) {
        return false;
      }
      return failureCount < 2;
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fresh-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading order details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    const safeMessage = SecurityUtils.formatSafeErrorMessage(error);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Error</AlertTitle>
              <AlertDescription className="mt-2">
                {safeMessage}
              </AlertDescription>
            </Alert>
            <div className="mt-6 flex justify-center">
              <Button asChild variant="outline">
                <Link to="/packer">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Order Not Found</AlertTitle>
              <AlertDescription>
                The requested order could not be found or you don't have access to it.
              </AlertDescription>
            </Alert>
            <div className="mt-6 flex justify-center">
              <Button asChild variant="outline">
                <Link to="/packer">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verify user has access to this specific order
  if (!canAccessOrder(order.packer_id)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription>
                You do not have permission to access this order. 
                {hasRole('packer') && ' This order is assigned to another packer.'}
              </AlertDescription>
            </Alert>
            <div className="mt-6 flex justify-center">
              <Button asChild variant="outline">
                <Link to="/packer">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <Button asChild variant="outline">
            <Link to="/packer">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        
        <PackingWorkflow orderId={orderId} />
      </div>
    </div>
  );
};

export default PackingStation;
