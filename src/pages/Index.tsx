
import { Button } from "@/components/ui/button";
import { ShoppingCart, Terminal } from "lucide-react";
import FreshnessBadge from "@/components/FreshnessBadge";
import AppleIcon from "@/components/AppleIcon";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const Index = () => {
  const fetchProduct = async () => {
    // Fetch the first product for this demo
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .limit(1)
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return data;
  };

  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product"],
    queryFn: fetchProduct,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xs mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6">
            <header className="flex justify-between items-center mb-4">
              <Skeleton className="h-7 w-3/5" />
              <Button variant="ghost" size="icon" disabled>
                <ShoppingCart className="h-6 w-6 text-gray-400" />
              </Button>
            </header>
            <main>
              <div className="flex justify-center mb-4">
                <Skeleton className="w-40 h-40 rounded-full" />
              </div>
              <div className="flex flex-col items-center space-y-2 mt-4">
                <Skeleton className="h-9 w-4/5" />
                <Skeleton className="h-8 w-1/2" />
                <div className="pt-4" />
                <Skeleton className="h-10 w-44" />
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error Fetching Product</AlertTitle>
          <AlertDescription>
            {error?.message ||
              "Could not find the product. The database might be empty."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const pickedAt = new Date(product.checked_in_at);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xs mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6">
          <header className="flex justify-between items-center mb-4">
            <h1 className="text-lg font-medium text-gray-500">
              Fruits & Vegetables
            </h1>
            <Button variant="ghost" size="icon">
              <ShoppingCart className="h-6 w-6 text-gray-400" />
            </Button>
          </header>

          <main>
            <div className="flex justify-center mb-4">
              <div className="w-40 h-40 bg-gray-100/60 rounded-full flex items-center justify-center">
                <AppleIcon className="w-24 h-24 text-gray-400" />
              </div>
            </div>

            <h2 className="text-3xl font-bold text-center text-gray-800 mb-1">
              {product.name}
            </h2>
            <p className="text-2xl font-mono text-center text-gray-500 mb-6">
              ${Number(product.price).toFixed(2)}
            </p>

            <div className="flex justify-center mb-6">
              <FreshnessBadge pickedAt={pickedAt} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Index;
