
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Box } from "lucide-react";

const fetchOrders = async () => {
  // Fetch all orders, both pending and completed, for this packer
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("status", { ascending: true }) // "pending_packing" before "packed"
    .order("created_at", { ascending: false }); // Most recent first
  if (error) throw new Error(error.message);
  return data;
};

const PackerDashboard = () => {
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["packerOrders"],
    queryFn: fetchOrders,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
        <Alert variant="destructive" className="bg-white">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Could not fetch orders: {error.message}</AlertDescription>
        </Alert>
    );
  }

  const pendingOrders = orders?.filter(o => o.status !== "packed") || [];
  const completedOrders = orders?.filter(o => o.status === "packed") || [];

  return (
    <div>
      {(!pendingOrders.length && !completedOrders.length) ? (
        <Alert className="bg-white">
            <Box className="h-4 w-4"/>
            <AlertTitle>All caught up!</AlertTitle>
            <AlertDescription>There are no orders pending packing.</AlertDescription>
        </Alert>
      ) : (
        <>
          {pendingOrders.length > 0 && (
            <>
              <h2 className="font-semibold text-lg mb-1">Pending Orders</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                {pendingOrders.map((order) => (
                  <Card key={order.id} className="bg-white border-gray-200 shadow-sm">
                    <CardHeader className="bg-white">
                      <CardTitle className="text-gray-900">Order #{order.order_number}</CardTitle>
                    </CardHeader>
                    <CardContent className="bg-white">
                      <p className="text-sm text-gray-600">Status: {order.status}</p>
                      <p className="text-sm text-gray-600">Received: {new Date(order.created_at).toLocaleString()}</p>
                    </CardContent>
                    <CardFooter className="bg-white">
                      <Button asChild className="w-full">
                        <Link to={`/packer/${order.id}`}>Start Packing</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </>
          )}
          {completedOrders.length > 0 && (
            <>
              <h2 className="font-semibold text-lg mb-1">Completed Orders</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedOrders.map((order) => (
                  <Card key={order.id} className="bg-white border-gray-200 shadow-sm opacity-70">
                    <CardHeader className="bg-white">
                      <CardTitle className="text-gray-900">Order #{order.order_number}</CardTitle>
                    </CardHeader>
                    <CardContent className="bg-white">
                      <p className="text-sm text-gray-600">Status: Packed</p>
                      <p className="text-sm text-gray-600">Packed At: {new Date(order.created_at).toLocaleString()}</p>
                    </CardContent>
                    <CardFooter className="bg-white">
                      <Button asChild className="w-full" variant="outline" disabled>
                        <span>Completed</span>
                      </Button>
                    </CardFooter>
                  </Card>
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
