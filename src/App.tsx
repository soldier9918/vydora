import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ConfirmDialogHost } from "@/components/ConfirmDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import RouteSeo from "@/components/RouteSeo";
import { AuthProvider } from "@/hooks/useAuth";
const Autopilot = lazy(() => import("@/pages/Autopilot"));
import Feedback from "@/pages/Feedback";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const MyVideos = lazy(() => import("./pages/MyVideos"));
const Create = lazy(() => import("./pages/Create"));
const VideoEditor = lazy(() => import("./pages/VideoEditor"));
import Legal from "./pages/Legal";
import Pricing from "./pages/Pricing";
const Billing = lazy(() => import("./pages/Billing"));
const Library = lazy(() => import("./pages/Library"));
const Profile = lazy(() => import("./pages/Profile"));
const Series = lazy(() => import("./pages/Series"));
const Admin = lazy(() => import("./pages/Admin"));
import NotFound from "./pages/NotFound";
import FeatureLanding from "./pages/FeatureLanding";
import Guides from "./pages/Guides";
import Community from "./pages/Community";
const CommunityCreator = lazy(() => import("./pages/CommunityCreator"));
const CommunityMe = lazy(() => import("./pages/CommunityMe"));
import GuideArticle from "./pages/GuideArticle";
import { GUIDES } from "@/lib/guides";
import { FEATURE_PAGES } from "@/lib/featurePages";
import { ReferralCatcher } from "@/lib/account";
import PostLoginRedirect from "@/components/PostLoginRedirect";
import { LEGAL_DOCS } from "@/lib/legal";

import { queryClient } from "@/lib/queryClient";
import CookieBanner from "@/components/consent/CookieBanner";
import GoogleAdsTracker from "@/components/consent/GoogleAdsTracker";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Sonner />
        <ConfirmDialogHost />
        <BrowserRouter>
          <ReferralCatcher />
          <PostLoginRedirect />
          <ScrollToTop />
          <RouteSeo />
          <GoogleAdsTracker />
          <CookieBanner />
          <Suspense fallback={<div className="min-h-screen" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            {FEATURE_PAGES.map((p) => <Route key={p.slug} path={`/${p.slug}`} element={<FeatureLanding page={p} />} />)}
            <Route path="/guides" element={<Guides />} />
            <Route path="/community" element={<Community />} />
            <Route path="/community/creator/:slug" element={<CommunityCreator />} />
            <Route path="/community/me" element={<ProtectedRoute><CommunityMe /></ProtectedRoute>} />
            {GUIDES.map((g) => <Route key={g.slug} path={`/guides/${g.slug}`} element={<GuideArticle guide={g} />} />)}
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><MyVideos /></ProtectedRoute>} />
            <Route path="/my-videos" element={<ProtectedRoute><MyVideos /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute><Create /></ProtectedRoute>} />
            <Route path="/from-url" element={<ProtectedRoute><Create key="url" fromUrl /></ProtectedRoute>} />
            <Route path="/series" element={<ProtectedRoute><Series /></ProtectedRoute>} />
            <Route path="/ads" element={<ProtectedRoute><Create key="ads" adMode /></ProtectedRoute>} />
            <Route path="/autopilot" element={<ProtectedRoute><Autopilot /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
            <Route path="/video/:id" element={<ProtectedRoute><VideoEditor /></ProtectedRoute>} />
            <Route path="/admin-kb20" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            {LEGAL_DOCS.map((doc) => (
              <Route key={doc.slug} path={`/${doc.slug}`} element={<Legal slug={doc.slug} />} />
            ))}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
