import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Redirect, Route, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/layout";

export function ProtectedRoute({
  path,
  component: Component,
  allowedRoles = ["user", "admin"], // Default to allowing both roles
}: {
  path: string;
  component: () => React.JSX.Element;
  allowedRoles?: string[];
}) {
  const { user, isLoading, checkSession } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [location, setLocation] = useLocation();

  // Determine if this is an admin route
  const isAdminRoute = path.startsWith('/admin');
  
  // Log the component rendering for debugging
  console.log(`ProtectedRoute for "${path}" rendering:`, { 
    location, 
    userExists: !!user, 
    userRole: user?.role,
    allowedRoles,
    isLoading, 
    verifying, 
    sessionChecked 
  });

  // On initial render, verify the session explicitly
  useEffect(() => {
    if (!isLoading && !user && !sessionChecked) {
      // Only check if we're not already loading and don't have a user
      setVerifying(true);
      
      console.log(`ProtectedRoute "${path}" checking session`);
      checkSession().then(isValid => {
        setVerifying(false);
        setSessionChecked(true);
        console.log(`ProtectedRoute "${path}" session check result:`, isValid);
      }).catch((error) => {
        console.error(`ProtectedRoute "${path}" session check error:`, error);
        setVerifying(false);
        setSessionChecked(true);
      });
    }
  }, [isLoading, user, sessionChecked, checkSession, path]);

  // If user is authenticated...
  if (user) {
    // Check if the user has the required role or permissions
    let hasAccess = false;
    
    // First check if the user's role is directly in the allowed roles
    if (allowedRoles.includes(user.role)) {
      hasAccess = true;
    } 
    // Then check for committee-specific roles
    else if (
      (allowedRoles.includes("committee_chair") && user.role === "committee_chair") ||
      (allowedRoles.includes("committee_cochair") && user.role === "committee_cochair") ||
      (allowedRoles.includes("committee_member") && user.role === "committee_member")
    ) {
      hasAccess = true;
    }
    // Finally check specific permissions
    else if (
      (allowedRoles.includes("can_manage_committees") && user.canManageCommittees) ||
      (allowedRoles.includes("can_manage_workshops") && user.canManageWorkshops)
    ) {
      hasAccess = true;
    }
    
    if (!hasAccess) {
      console.log(`ProtectedRoute "${path}": User role ${user.role} not allowed, redirecting`);
      
      // Redirect based on user role to their appropriate dashboard
      let redirectPath = '/';
      if (user.role === 'admin') {
        redirectPath = '/admin';
      } else if (user.role === 'committee_chair' || user.role === 'committee_cochair') {
        redirectPath = '/committee-admin';
      }
      
      return (
        <Route path={path}>
          <Redirect to={redirectPath} />
        </Route>
      );
    }
    
    console.log(`ProtectedRoute "${path}": User authenticated with role ${user.role}, rendering component`);
    return (
      <Route path={path}>
        <Layout>
          <Component />
        </Layout>
      </Route>
    );
  }

  // Show loading spinner during both initial loading and verify states
  if (isLoading || verifying) {
    console.log(`ProtectedRoute "${path}": Still loading or verifying`);
    return (
      <Route path={path}>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">
            {verifying ? "Verifying your session..." : "Loading..."}
          </p>
        </div>
      </Route>
    );
  }

  // If we've checked the session and still don't have a user, redirect to appropriate login
  console.log(`ProtectedRoute "${path}": No authenticated user, redirecting to login`);
  return (
    <Route path={path}>
      <Redirect to={isAdminRoute ? "/admin-login" : "/auth"} />
    </Route>
  );
}
