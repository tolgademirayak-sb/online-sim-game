import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import StartPage from "./pages/StartPage";
import Index from "./pages/Index";
import InstructorDashboard from "./pages/InstructorDashboard";
import MultiplayerLobby from "./pages/MultiplayerLobby";
import MultiplayerRoom from "./pages/MultiplayerRoom";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/singleplayer" element={<Index />} />
          <Route path="/multiplayer" element={<MultiplayerLobby />} />
          <Route path="/multiplayer/room/:roomId" element={<MultiplayerRoom />} />
          <Route path="/instructor" element={<InstructorDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
