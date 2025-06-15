
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import NotFound from "./pages/NotFound";
import Packer from "./pages/Packer";
import PackingStation from "./pages/PackingStation";
import { AuthProvider } from "./contexts/AuthContext";
import AuthPage from "./pages/Auth";
import { AuthLayout } from "./components/layout/AuthLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />

            <Route element={<AuthLayout />}>
              <Route path="/" element={<Packer />} />
              <Route path="/packer" element={<Packer />} />
              <Route path="/packer/:orderId" element={<PackingStation />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
