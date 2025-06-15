
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import FreshnessBadge from "@/components/FreshnessBadge";
import AppleIcon from "@/components/AppleIcon";

const Index = () => {
  const product = {
    name: "Fresh Produce",
    price: 2.50,
    // Mocking the pickedAt date to be 26 hours ago, as in the wireframe
    pickedAt: new Date(new Date().getTime() - 26 * 60 * 60 * 1000), 
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xs mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6">
          <header className="flex justify-between items-center mb-4">
            <h1 className="text-lg font-medium text-gray-500">Fruits & Vegetables</h1>
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

            <h2 className="text-3xl font-bold text-center text-gray-800 mb-1">{product.name}</h2>
            <p className="text-2xl font-mono text-center text-gray-500 mb-6">${product.price.toFixed(2)}</p>

            <div className="flex justify-center mb-6">
              <FreshnessBadge pickedAt={product.pickedAt} />
            </div>

            <div className="text-center text-gray-500 text-sm">
              <p>This produce was checked in our warehouse {differenceInHours(new Date(), product.pickedAt)} hours ago, ensuring maximum freshness at your doorstep.</p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

// Helper function to calculate difference for the description
const differenceInHours = (date1: Date, date2: Date) => {
    return Math.abs(Math.round((date1.getTime() - date2.getTime()) / 36e5));
}


export default Index;
