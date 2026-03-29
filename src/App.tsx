import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import { Loader2 } from "lucide-react";

// Eagerly loaded (landing + auth shell)
import LandingPage from "@/pages/LandingPage";
import MaintenanceInterceptor from "@/components/MaintenanceInterceptor";
import PwaInstallBanner from "@/components/PwaInstallBanner";

// Lazy-loaded pages
const AppLayout = lazy(() => import("@/components/AppLayout"));
const SongsPage = lazy(() => import("@/pages/SongsPage"));
const SongDetailPage = lazy(() => import("@/pages/SongDetailPage"));
const EditSongPage = lazy(() => import("@/pages/EditSongPage"));
const SetlistsPage = lazy(() => import("@/pages/SetlistsPage"));
const SetlistDetailPage = lazy(() => import("@/pages/SetlistDetailPage"));
const ArtistsPage = lazy(() => import("@/pages/ArtistsPage"));
const StudioPage = lazy(() => import("@/pages/StudioPage"));
const StudioDetailPage = lazy(() => import("@/pages/StudioDetailPage"));
const StudyPage = lazy(() => import("@/pages/StudyPage"));
const CompositionStudioPage = lazy(() => import("@/pages/CompositionStudioPage"));
const CompositionsHomePage = lazy(() => import("@/pages/CompositionsHomePage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const ArtistExplorePage = lazy(() => import("@/pages/ArtistExplorePage"));
const TunerPage = lazy(() => import("@/pages/TunerPage"));
const PublicLayout = lazy(() => import("@/components/PublicLayout"));
const PublicSetlistPage = lazy(() => import("@/pages/PublicSetlistPage"));
const PublicSongPage = lazy(() => import("@/pages/PublicSongPage"));
const TermsOfUsePage = lazy(() => import("@/pages/TermsOfUsePage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const AdminDashboardPage = lazy(() => import("@/pages/AdminDashboardPage"));
const AdminRoute = lazy(() => import("@/components/AdminRoute"));
const PricingPage = lazy(() => import("@/pages/PricingPage"));
const CommunityPage = lazy(() => import("@/pages/CommunityPage"));
const MessagesPage = lazy(() => import("@/pages/MessagesPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const TermsInterceptor = lazy(() => import("@/components/TermsInterceptor"));
const VipMaintenanceGuard = lazy(() => import("@/components/VipMaintenanceGuard"));
const OnboardingGuard = lazy(() => import("@/components/OnboardingGuard"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
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
              <Suspense fallback={<PageLoader />}>
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
              </Suspense>
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