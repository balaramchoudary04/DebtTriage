import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Debts from "@/pages/Debts";
import PayoffPlans from "@/pages/PayoffPlans";
import TransferConsolidation from "@/pages/TransferConsolidation";
import ScoreSimulator from "@/pages/ScoreSimulator";
import LetterGenerator from "@/pages/LetterGenerator";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/debts" component={Debts} />
        <Route path="/payoff" component={PayoffPlans} />
        <Route path="/transfer" component={TransferConsolidation} />
        <Route path="/score" component={ScoreSimulator} />
        <Route path="/letters" component={LetterGenerator} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
