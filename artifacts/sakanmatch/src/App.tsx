import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";

// Pages
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import NewListing from "@/pages/NewListing";
import ListingDetail from "@/pages/ListingDetail";
import Premium from "@/pages/Premium";
import Favorites from "@/pages/Favorites";
import Preferences from "@/pages/Preferences";
import Messages from "@/pages/Messages";
import Profile from "@/pages/Profile";
import PublicProfile from "@/pages/PublicProfile";
import People from "@/pages/People";
import Donate from "@/pages/Donate";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/listings/new" component={NewListing} />
      <Route path="/listings/:id" component={ListingDetail} />
      <Route path="/premium" component={Premium} />
      <Route path="/favorites" component={Favorites} />
      <Route path="/profile/preferences" component={Preferences} />
      <Route path="/messages" component={Messages} />
      <Route path="/messages/:userId" component={Messages} />
      <Route path="/profile/:userId" component={PublicProfile} />
      <Route path="/profile" component={Profile} />
      <Route path="/people" component={People} />
      <Route path="/donate" component={Donate} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
              <Toaster />
            </AuthProvider>
          </WouterRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
