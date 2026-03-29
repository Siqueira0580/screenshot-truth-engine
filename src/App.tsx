import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import AppLayout from "@/components/AppLayout";
import SongsPage from "@/pages/SongsPage";
import SongDetailPage from "@/pages/SongDetailPage";
import EditSongPage from "@/pages/EditSongPage";
import SetlistsPage from "@/pages/SetlistsPage";
import SetlistDetailPage from "@/pages/SetlistDetailPage";
import ArtistsPage from "@/pages/ArtistsPage";
import StudioPage from "@/pages/StudioPage";
import StudioDetailPage from "@/pages/StudioDetailPage";
import StudyPage from "@/pages/StudyPage";
import CompositionStudioPage from "@/pages/CompositionStudioPage";
import CompositionsHomePage from "@/pages/CompositionsHomePage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import LandingPage from "@/pages/LandingPage";

import ArtistExplorePage from "@/pages/ArtistExplorePage";
import TunerPage from "@/pages/TunerPage";
import PublicLayout from "@/components/PublicLayout";
import PublicSetlistPage from "@/pages/PublicSetlistPage";
import PublicSongPage from "@/pages/PublicSongPage";
import TermsOfUsePage from "@/pages/TermsOfUsePage";
import NotFound from "./pages/NotFound";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import AdminRoute from "@/components/AdminRoute";
import PricingPage from "@/pages/PricingPage";
import CommunityPage from "@/pages/CommunityPage";
import MessagesPage from "@/pages/MessagesPage";
import ChatPage from "@/pages/ChatPage";
import TermsInterceptor from "@/components/TermsInterceptor";
import MaintenanceInterceptor from "@/components/MaintenanceInterceptor";
import VipMaintenanceGuard from "@/components/VipMaintenanceGuard";
import PwaInstallBanner from "@/components/PwaInstallBanner";
import OnboardingGuard from "@/components/OnboardingGuard";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/songs" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
          <UserPreferencesProvider>
            <MaintenanceInterceptor>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
                <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route element={<ProtectedRoute><VipMaintenanceGuard><TermsInterceptor><OnboardingGuard><AppLayout /></OnboardingGuard></TermsInterceptor></VipMaintenanceGuard></ProtectedRoute>}>
                  <Route path="/songs" element={<SongsPage />} />
                  <Route path="/songs/:id" element={<SongDetailPage />} />
                  <Route path="/editar-musica/:id" element={<EditSongPage />} />
                  <Route path="/setlists" element={<SetlistsPage />} />
                  <Route path="/setlists/:id" element={<SetlistDetailPage />} />
                  <Route path="/artists" element={<ArtistsPage />} />
                  <Route path="/community" element={<CommunityPage />} />
                  <Route path="/mensagens" element={<MessagesPage />} />
                  <Route path="/mensagens/:userId" element={<ChatPage />} />
                  <Route path="/studio" element={<StudioPage />} />
                  <Route path="/studio/:songId" element={<StudioDetailPage />} />
                  <Route path="/compositions" element={<CompositionsHomePage />} />
                  <Route path="/compose" element={<CompositionStudioPage />} />
                  <Route path="/study/:songId" element={<StudyPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/tuner" element={<TunerPage />} />
                  <Route path="/artist/:artistName" element={<ArtistExplorePage />} />
                  <Route path="/planos" element={<PricingPage />} />
                </Route>
                <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
                
                <Route element={<PublicLayout />}>
                  <Route path="/share/setlist/:token" element={<PublicSetlistPage />} />
                  <Route path="/share/song/:id" element={<PublicSongPage />} />
                  <Route path="/terms" element={<TermsOfUsePage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MaintenanceInterceptor>
            <PwaInstallBanner />
          </UserPreferencesProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
