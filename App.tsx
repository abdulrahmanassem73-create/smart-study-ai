import * as React from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";

import Home from "@/pages/Home";

// Lazy routes to reduce initial bundle (mobile-friendly)
const AuthPage = React.lazy(() => import("@/pages/Auth"));
const LibraryPage = React.lazy(() => import("@/pages/Library"));
const ExplainPage = React.lazy(() => import("@/pages/Explain"));
const UploadPage = React.lazy(() => import("@/pages/Upload"));
const QuestionBankPage = React.lazy(() => import("@/pages/QuestionBank"));
const StatsPage = React.lazy(() => import("@/pages/Stats"));
const SettingsPage = React.lazy(() => import("@/pages/Settings"));
const ProfilePage = React.lazy(() => import("@/pages/Profile"));
const ShopPage = React.lazy(() => import("@/pages/Shop"));
const LeaderboardPage = React.lazy(() => import("@/pages/Leaderboard"));
const ExamPage = React.lazy(() => import("@/pages/Exam"));

// Use hash-based routing (/#/) to support opening index.html directly via file:// protocol
// Tolerant routing: unmatched paths are treated as anchor sections (e.g., /#/services → scroll to #services)
// For in-page anchors, use <Link href="/section"> instead of <a href="#section">
function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={Home} />

        <Route
          path="/auth"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <AuthPage />
            </React.Suspense>
          )}
        />
        <Route
          path="/مكتبتي"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <LibraryPage />
            </React.Suspense>
          )}
        />
        <Route
          path="/رفع-المادة"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <UploadPage />
            </React.Suspense>
          )}
        />
        {/* Deep linking (hash routing): /#/explain/:fileId or /#/شرح/:fileId */}
        <Route
          path="/explain/:fileId"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <ExplainPage />
            </React.Suspense>
          )}
        />
        <Route
          path="/شرح/:fileId"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <ExplainPage />
            </React.Suspense>
          )}
        />
        {/* Backward compatible */}
        <Route
          path="/شرح"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <ExplainPage />
            </React.Suspense>
          )}
        />
        {/* Deep linking: /#/بنك-الأسئلة/:fileId */}
        <Route
          path="/بنك-الأسئلة/:fileId"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <QuestionBankPage />
            </React.Suspense>
          )}
        />
        {/* Backward compatible */}
        <Route
          path="/بنك-الأسئلة"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <QuestionBankPage />
            </React.Suspense>
          )}
        />
        <Route
          path="/الإحصائيات"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <StatsPage />
            </React.Suspense>
          )}
        />
        <Route
          path="/الإعدادات"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <SettingsPage />
            </React.Suspense>
          )}
        />
        <Route
          path="/profile"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <ProfilePage />
            </React.Suspense>
          )}
        />
        <Route
          path="/المتجر"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <ShopPage />
            </React.Suspense>
          )}
        />
        {/* Deep linking: /#/exam/:fileId or /#/امتحان/:fileId */}
        <Route
          path="/exam/:fileId"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <ExamPage />
            </React.Suspense>
          )}
        />
        <Route
          path="/امتحان/:fileId"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <ExamPage />
            </React.Suspense>
          )}
        />
        {/* Backward compatible */}
        <Route
          path="/امتحان"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <ExamPage />
            </React.Suspense>
          )}
        />

        <Route
          path="/لوحة-الشرف"
          component={() => (
            <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">جاري التحميل...</div>}>
              <LeaderboardPage />
            </React.Suspense>
          )}
        />
      </Switch>
    </Router>
  );
}

// Note on theming:
// - Choose defaultTheme based on your design (light or dark background)
// - Update the color palette in index.css to match
// - If you want switchable themes, add `switchable` prop and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

