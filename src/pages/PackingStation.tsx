
import PackingWorkflow from "@/components/packer/PackingWorkflow";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PackingStation = () => {
  const { orderId } = useParams<{ orderId: string }>();

  if (!orderId) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-red-500">Invalid Order ID.</p>
        <Button asChild variant="link" className="mt-4">
          <Link to="/packer">Go back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <PackingWorkflow orderId={orderId} />
  );
};

export default PackingStation;
