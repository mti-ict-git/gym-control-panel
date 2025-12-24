import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import GymUsersPage from "./pages/GymUsersPage";
import UserDetailPage from "./pages/UserDetailPage";
import SchedulesPage from "./pages/SchedulesPage";
import SettingsPage from "./pages/SettingsPage";
import VaultPage from "./pages/VaultPage";
import EntryModePage from "./pages/EntryModePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <GymUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/:userId"
              element={
                <ProtectedRoute>
                  <UserDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vault"
              element={
                <ProtectedRoute>
                  <VaultPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/schedules"
              element={
                <ProtectedRoute>
                  <SchedulesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/entry"
              element={
                <ProtectedRoute>
                  <EntryModePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
