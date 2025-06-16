
import PackerDashboard from "@/components/packer/PackerDashboard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import CreateOrderForm from "@/components/packer/CreateOrderForm";

const Packer = () => {
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Freshness Checker Dashboard</h1>
            <p className="text-muted-foreground">Orders waiting to be processed.</p>
        </div>
        <Dialog open={isCreateOrderOpen} onOpenChange={setIsCreateOrderOpen}>
            <DialogTrigger asChild>
                <Button>Create Manual Order</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a New Order</DialogTitle>
                    <DialogDescription>
                        Enter the order number to create a new order for processing.
                    </DialogDescription>
                </DialogHeader>
                <CreateOrderForm onOrderCreated={() => setIsCreateOrderOpen(false)} />
            </DialogContent>
        </Dialog>
      </header>
      <PackerDashboard />
    </>
  );
};

export default Packer;
