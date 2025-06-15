
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Box } from "lucide-react";

const fetchPendingOrders = async () => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "pending_packing")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
};

const PackerDashboard = () => {
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["pendingOrders"],
    queryFn: fetchPendingOrders,
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
        <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Could not fetch orders: {error.message}</AlertDescription>
        </Alert>
    );
  }

  return (
    <div>
      {orders?.length === 0 ? (
        <Alert>
            <Box className="h-4 w-4"/>
            <AlertTitle>All caught up!</AlertTitle>
            <AlertDescription>There are no orders pending packing.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orders?.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <CardTitle>Order #{order.order_number}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Status: {order.status}</p>
                <p className="text-sm text-muted-foreground">Received: {new Date(order.created_at).toLocaleString()}</p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link to={`/packer/${order.id}`}>Start Packing</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PackerDashboard;
