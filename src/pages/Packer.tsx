
import PackerDashboard from "@/components/packer/PackerDashboard";

const Packer = () => {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Packer Dashboard</h1>
        <p className="text-muted-foreground">Orders waiting to be packed.</p>
      </header>
      <PackerDashboard />
    </>
  );
};

export default Packer;
