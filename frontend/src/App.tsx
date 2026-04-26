import { lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/layout/Layout";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { usePreferences } from "@/store/preferences";

const Dashboard = lazy(() => import("@/routes/Dashboard"));
const PrintHistory = lazy(() => import("@/routes/PrintHistory"));
const PrintDetail = lazy(() => import("@/routes/PrintDetail"));
const Stats = lazy(() => import("@/routes/Stats"));
const Settings = lazy(() => import("@/routes/Settings"));

export default function App() {
  const refreshSeconds = usePreferences((s) => s.refreshIntervalSeconds);
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: refreshSeconds * 1000,
            refetchInterval: refreshSeconds * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
    [refreshSeconds],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route
                index
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Dashboard />
                  </Suspense>
                }
              />
              <Route
                path="prints"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <PrintHistory />
                  </Suspense>
                }
              />
              <Route
                path="prints/:id"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <PrintDetail />
                  </Suspense>
                }
              />
              <Route
                path="stats"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Stats />
                  </Suspense>
                }
              />
              <Route
                path="settings"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Settings />
                  </Suspense>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
