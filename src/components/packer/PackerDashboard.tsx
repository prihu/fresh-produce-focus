
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Box } from "lucide-react";
import OrderCard from "./dashboard/OrderCard";
import SecureCreateOrderForm from './SecureCreateOrderForm';
import { ModernSkeleton } from "@/components/ui/modern-skeleton";

const fetchOrders = async () => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const PackerDashboard = () => {
  const { data: orders, isLoading, error, isRefetching } = useQuery({
    queryKey: ["packerOrders"],
    queryFn: fetchOrders,
    refetchOnWindowFocus: false,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Function to determine the header text and description based on order states
  const getHeaderContent = () => {
    if (!orders || orders.length === 0) {
      return {
        title: "No orders found",
        description: "There are currently no orders in the system."
      };
    }

    const pendingOrders = orders.filter(o => o.status !== "packed");
    const completedOrders = orders.filter(o => o.status === "packed");

    if (pendingOrders.length > 0 && completedOrders.length === 0) {
      return {
        title: "Orders waiting to be processed",
        description: `${pendingOrders.length} order${pendingOrders.length === 1 ? '' : 's'} pending packing.`
      };
    }

    if (pendingOrders.length === 0 && completedOrders.length > 0) {
      return {
        title: "All orders packed",
        description: `${completedOrders.length} order${completedOrders.length === 1 ? '' : 's'} completed.`
      };
    }

    if (pendingOrders.length > 0 && completedOrders.length > 0) {
      return {
        title: "Orders waiting to be processed",
        description: `${pendingOrders.length} pending, ${completedOrders.length} completed.`
      };
    }

    return {
      title: "Freshness Checker Dashboard",
      description: "Orders management dashboard."
    };
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="space-y-3">
          <ModernSkeleton variant="wave" className="h-9 w-80" />
          <ModernSkeleton variant="wave" className="h-5 w-64" />
        </div>
        
        {/* Form skeleton */}
        <div className="bg-white rounded-2xl border border-subtle p-6">
          <ModernSkeleton variant="wave" className="h-6 w-40 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ModernSkeleton variant="wave" className="h-11 w-full" />
            <ModernSkeleton variant="wave" className="h-11 w-full" />
          </div>
        </div>
        
        {/* Cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-subtle p-6">
              <ModernSkeleton variant="wave" lines={4} avatar />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
        <Alert variant="destructive" className="bg-red-50 border-red-200 rounded-2xl">
            <AlertTitle className="text-red-900 text-heading-secondary">Error</AlertTitle>
            <AlertDescription className="text-red-800 text-body-primary">
              Could not fetch orders: {error.message}
            </AlertDescription>
        </Alert>
    );
  }

  const pendingOrders = orders?.filter(o => o.status !== "packed") || [];
  const completedOrders = orders?.filter(o => o.status === "packed") || [];
  const headerContent = getHeaderContent();

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-heading-primary mb-2">
          {headerContent.title}
        </h1>
        <p className="text-body-secondary text-sm sm:text-base">{headerContent.description}</p>
      </header>

      <SecureCreateOrderForm />
      
      {isRefetching && (
        <div className="text-sm text-body-muted text-center py-2 bg-gray-50 rounded-xl border border-subtle animate-pulse">
          Refreshing orders...
        </div>
      )}
      
      {(!pendingOrders.length && !completedOrders.length) ? (
        <Alert className="bg-gray-50 border-subtle rounded-2xl">
            <Box className="h-5 w-5 text-gray-500"/>
            <AlertTitle className="text-heading-secondary">All caught up!</AlertTitle>
            <AlertDescription className="text-body-secondary">
              There are no orders pending packing.
            </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-8">
          {pendingOrders.length > 0 && (
            <section className="animate-slide-in-right">
              <h2 className="font-semibold text-lg sm:text-xl mb-4 text-heading-secondary">
                Pending Orders
                <span className="ml-2 text-sm font-medium text-body-muted bg-gray-100 px-2 py-1 rounded-md">
                  {pendingOrders.length}
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pendingOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </section>
          )}
          
          {completedOrders.length > 0 && (
            <section className="animate-slide-in-right animate-delay-100">
              <h2 className="font-semibold text-lg sm:text-xl mb-4 text-heading-secondary">
                Completed Orders
                <span className="ml-2 text-sm font-medium text-body-muted bg-green-100 text-green-700 px-2 py-1 rounded-md">
                  {completedOrders.length}
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completedOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default PackerDashboard;
