import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { useGetRecoverySession } from '@/hooks/api';
import { Layout } from '@/components/layout';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import DeviceDetail from '@/pages/device-detail';
import IncidentsList from '@/pages/incidents';
import IncidentDetail from '@/pages/incident-detail';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <p className="mt-4 text-sm font-medium text-muted-foreground uppercase tracking-widest">
        Verifying Security Context...
      </p>
    </div>
  );
}

function AuthWrapper({ children }: { children: ReactNode }) {
  const { data: session, isLoading, isError } = useGetRecoverySession({ request: { credentials: "include" } });

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isError || !session?.authenticated) {
    return <Login />;
  }

  return <Layout>{children}</Layout>;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/">
          <AuthWrapper>
            <Dashboard />
          </AuthWrapper>
        </Route>
        <Route path="/incidents">
          <AuthWrapper>
            <IncidentsList />
          </AuthWrapper>
        </Route>
        <Route path="/incidents/:incidentId">
          <AuthWrapper>
            <IncidentDetail />
          </AuthWrapper>
        </Route>
        <Route path="/devices/:endpointId">
          <AuthWrapper>
            <DeviceDetail />
          </AuthWrapper>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
