import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";


import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import OnboardingPage from "@/pages/onboarding-page";
import MembersPage from "@/pages/members-page";
import MemberDetailPage from "@/pages/member-detail";
import WorkshopsPage from "@/pages/workshops-page";
import CommitteeManagementPage from "@/pages/committee-management";
import CommitteeAdminPage from "@/pages/committee-admin-simple";
import CommitteeSelectionPage from "@/pages/committee-selection";
import ChairLoginPage from "@/pages/chair-login";
import AdminUsersPage from "@/pages/admin-users-page";
import MemberStatisticsPage from "@/pages/member-statistics";
import WorkshopPricingPage from "@/pages/workshop-pricing-page";
import MembershipPricingPage from "@/pages/membership-pricing-page";
import NotFound from "@/pages/not-found";

// This component ensures cookies are sent with all requests and session is maintained
function CookieRefresher() {
  const [location] = useLocation();

  useEffect(() => {
    // Force a simple request to refresh cookies
    const checkAuth = async () => {
      try {
        console.log("Refreshing authentication cookies...");
        const response = await fetch("/api/session/check", { 
          credentials: "include",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log("Auth check completed:", data.authenticated ? "Authenticated" : "Not authenticated");
        } else {
          console.log("Auth check request failed with status:", response.status);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      }
    };
    
    // Immediately check auth on component mount
    checkAuth();
    
    // Set up interval to periodically check auth (every 2 minutes)
    const checkInterval = setInterval(checkAuth, 2 * 60 * 1000);
    
    // Also check auth on location changes
    return () => {
      clearInterval(checkInterval);
    };
  }, []);
  
  // Additionally check auth on every navigation
  useEffect(() => {
    // Skip on initial load since we already check in the main effect
    if (location !== "/") {
      const checkAuth = async () => {
        try {
          console.log("Navigation auth check for:", location);
          const response = await fetch("/api/session/check", { 
            credentials: "include",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache"
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log("Navigation auth check result:", data.authenticated ? "Authenticated" : "Not authenticated");
          } else {
            console.log("Navigation auth check request failed with status:", response.status);
          }
        } catch (error) {
          console.error("Navigation auth check failed:", error);
        }
      };
      
      checkAuth();
    }
  }, [location]);
  
  return null;
}

function Router() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Log navigation for debugging
  useEffect(() => {
    console.log("Navigation to:", location);
  }, [location]);
  
  return (
    <Switch>
      {/* Root route - redirect to login or dashboard based on auth status */}
      <Route path="/">
        {user ? (
          user.role === "admin" ? <Dashboard /> : <Dashboard />
        ) : (
          <AuthPage isAdminLogin={false} />
        )}
      </Route>
      
      {/* Member Portal Routes */}
      <ProtectedRoute path="/profile" component={Profile} allowedRoles={["user", "admin"]} />
      <ProtectedRoute path="/onboarding" component={OnboardingPage} allowedRoles={["user"]} />
      <ProtectedRoute path="/messages" component={Dashboard} allowedRoles={["user"]} />
      <ProtectedRoute path="/workshops" component={WorkshopsPage} allowedRoles={["user", "admin"]} />
      <ProtectedRoute path="/pricing" component={MembershipPricingPage} allowedRoles={["user", "admin"]} />
      <ProtectedRoute path="/events" component={Dashboard} allowedRoles={["user"]} />
      
      {/* Admin Portal Routes */}
      <ProtectedRoute path="/admin" component={Dashboard} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/members" component={MembersPage} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/members/:id" component={MemberDetailPage} allowedRoles={["admin"]} />
      <ProtectedRoute path="/member-statistics" component={MemberStatisticsPage} allowedRoles={["admin"]} />
      <ProtectedRoute path="/workshop-pricing" component={WorkshopPricingPage} allowedRoles={["admin"]} />
      <ProtectedRoute path="/admin/committees" component={CommitteeManagementPage} allowedRoles={["admin", "committee_chair", "committee_cochair"]} />
      <ProtectedRoute path="/admin/users" component={AdminUsersPage} allowedRoles={["admin"]} />
      <ProtectedRoute path="/users" component={AdminUsersPage} allowedRoles={["admin"]} />
      <ProtectedRoute path="/surveys" component={Dashboard} allowedRoles={["admin"]} />
      <ProtectedRoute path="/committee-selection" component={CommitteeSelectionPage} allowedRoles={["committee_chair", "committee_cochair"]} />
      <ProtectedRoute path="/committee-admin" component={CommitteeAdminPage} allowedRoles={["committee_chair", "committee_cochair"]} />
      
      {/* Public Routes */}
      <Route path="/auth">
        <AuthPage isAdminLogin={false} />
      </Route>
      <Route path="/admin-login">
        <AuthPage isAdminLogin={true} />
      </Route>
      <Route path="/chair-login">
        <ChairLoginPage />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

// We need to import useAuth inside a component that's a child of AuthProvider
const AppContent = () => {
  // Import the auth hook
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  
  // Don't show navbar on login pages
  const hideNavbar = location === '/auth' || location === '/admin-login' || location === '/chair-login' || !user;
  
  return (
    <>
      <CookieRefresher />
      {!hideNavbar && <Navbar />}
      <Router />
      <Toaster />
    </>
  );
};

function App() {

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
