import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import GymUsersPage from "./pages/GymUsersPage";
import UserDetailPage from "./pages/UserDetailPage";
import SchedulesPage from "./pages/SchedulesPage";
import VaultPage from "./pages/VaultPage";
import EntryModePage from "./pages/EntryModePage";
import NotFound from "./pages/NotFound";

// Settings pages
import SettingsLayout from "./pages/settings/SettingsLayout";
import ProfileSettings from "./pages/settings/ProfileSettings";
import SecuritySettings from "./pages/settings/SecuritySettings";
import ActiveDirectorySettings from "./pages/settings/ActiveDirectorySettings";
import WhatsAppSettings from "./pages/settings/WhatsAppSettings";
import DatabaseSettings from "./pages/settings/DatabaseSettings";

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
            {/* Settings routes with nested layout */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/settings/profile" replace />} />
              <Route path="profile" element={<ProfileSettings />} />
              <Route path="security" element={<SecuritySettings />} />
              <Route path="config/active-directory" element={<ActiveDirectorySettings />} />
              <Route path="config/whatsapp" element={<WhatsAppSettings />} />
              <Route path="config/database" element={<DatabaseSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
