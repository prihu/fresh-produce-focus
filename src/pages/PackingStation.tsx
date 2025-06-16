
import PackingWorkflow from "@/components/packer/PackingWorkflow";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PackingStation = () => {
  const { orderId } = useParams<{ orderId: string }>();

  if (!orderId) {
    return (
      <div className="container mx-auto p-4 text-center bg-white min-h-screen">
        <p className="text-red-500">Invalid Order ID.</p>
        <Button asChild variant="link" className="mt-4">
          <Link to="/packer">Go back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <PackingWorkflow orderId={orderId} />
    </div>
  );
};

export default PackingStation;
