import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";

const StartPage = lazy(() => import("./pages/StartPage"));
const Index = lazy(() => import("./pages/Index"));
const InstructorDashboard = lazy(() => import("./pages/InstructorDashboard"));
const MultiplayerLobby = lazy(() => import("./pages/MultiplayerLobby"));
const MultiplayerRoom = lazy(() => import("./pages/MultiplayerRoom"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">Loading...</div>}> 
            <Routes>
              <Route path="/" element={<StartPage />} />
              <Route path="/singleplayer" element={<Index />} />
              <Route path="/multiplayer" element={<MultiplayerLobby />} />
              <Route path="/multiplayer/room/:roomId" element={<MultiplayerRoom />} />
              <Route path="/instructor" element={<InstructorDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
