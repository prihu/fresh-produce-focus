
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Box } from "lucide-react";
import OrderCard from "./dashboard/OrderCard";
import SecureCreateOrderForm from './SecureCreateOrderForm';

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
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
        <Alert variant="destructive" className="bg-white border-red-200">
            <AlertTitle className="text-red-900">Error</AlertTitle>
            <AlertDescription className="text-red-800">Could not fetch orders: {error.message}</AlertDescription>
        </Alert>
    );
  }

  const pendingOrders = orders?.filter(o => o.status !== "packed") || [];
  const completedOrders = orders?.filter(o => o.status === "packed") || [];
  const headerContent = getHeaderContent();

  return (
    <div className="space-y-6">
      <header className="mb-6 bg-white">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{headerContent.title}</h1>
        <p className="text-gray-700">{headerContent.description}</p>
      </header>

      <SecureCreateOrderForm />
      
      {isRefetching && (
        <div className="text-sm text-gray-500 text-center">
          Refreshing orders...
        </div>
      )}
      
      {(!pendingOrders.length && !completedOrders.length) ? (
        <Alert className="bg-white border-gray-200">
            <Box className="h-4 w-4 text-gray-700"/>
            <AlertTitle className="text-gray-900">All caught up!</AlertTitle>
            <AlertDescription className="text-gray-700">There are no orders pending packing.</AlertDescription>
        </Alert>
      ) : (
        <>
          {pendingOrders.length > 0 && (
            <>
              <h2 className="font-semibold text-lg mb-4 text-gray-900">Pending Orders</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                {pendingOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </>
          )}
          {completedOrders.length > 0 && (
            <>
              <h2 className="font-semibold text-lg mb-4 text-gray-900">Completed Orders</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default PackerDashboard;
