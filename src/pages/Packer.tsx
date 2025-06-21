
import PackerDashboard from "@/components/packer/PackerDashboard";
import { UserNav } from "@/components/layout/UserNav";

const Packer = () => {
  return (
    <div className="bg-white min-h-screen">
      {/* Header with logout */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Zepto Freshness Checker
              </h1>
            </div>
            <UserNav />
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PackerDashboard />
      </main>
    </div>
  );
};

export default Packer;
