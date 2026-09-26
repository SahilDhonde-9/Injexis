import React, { useEffect, Component } from "react";
import type { ReactNode } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { SpiderWeb } from "@/components/spider-web";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Analyzer from "@/pages/analyzer";
import Dashboard from "@/pages/dashboard";
import Logs from "@/pages/logs";
import Chat from "@/pages/chat";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-8">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-bold font-mono text-red-400">Something went wrong</h1>
          <p className="text-sm text-muted-foreground font-mono max-w-md text-center">
            {(this.state.error as Error).message}
          </p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = "/"; }}
            className="mt-2 px-4 py-2 rounded-lg border border-border bg-card text-sm font-mono hover:border-primary transition-colors"
          >
            Go home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/analyzer">
        <ErrorBoundary><Layout><Analyzer /></Layout></ErrorBoundary>
      </Route>
      <Route path="/chat">
        <ErrorBoundary><Layout><Chat /></Layout></ErrorBoundary>
      </Route>
      <Route path="/dashboard">
        <ErrorBoundary><Layout><Dashboard /></Layout></ErrorBoundary>
      </Route>
      <Route path="/logs">
        <ErrorBoundary><Layout><Logs /></Layout></ErrorBoundary>
      </Route>
      <Route path="/settings">
        <ErrorBoundary><Layout><Settings /></Layout></ErrorBoundary>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <SpiderWeb />
          <ErrorBoundary>
            <Router />
          </ErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
