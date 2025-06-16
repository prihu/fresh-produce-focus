
import PackerDashboard from "@/components/packer/PackerDashboard";

const Packer = () => {
  return (
    <div className="bg-white min-h-screen">
      <header className="mb-6 bg-white">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Freshness Checker Dashboard</h1>
        <p className="text-gray-700">Orders waiting to be processed.</p>
      </header>
      <PackerDashboard />
    </div>
  );
};

export default Packer;
