import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Auth token management
const AUTH_TOKEN_KEY = 'csc_auth_token'; // Must match the key in queryClient.ts

function saveAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  console.log('Auth token saved to localStorage');
}

function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  console.log('Auth token removed from localStorage');
}

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  adminLoginMutation: UseMutationResult<SelectUser, Error, AdminLoginData>;
  memberLoginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
  checkSession: () => Promise<boolean>;
};

// Support both "email" and "username" for backwards compatibility
type LoginData = {
  email?: string;
  username?: string;
  password: string;
};

// Admin login uses username field specifically
type AdminLoginData = {
  username: string;
  password: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    // Use longer stale time for stability
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Force retry on errors
    retry: 3,
    retryDelay: attempt => Math.min(attempt * 1000, 5000),
  });

  // Function to check if session is valid with retry logic and token fallback
  const checkSession = async (): Promise<boolean> => {
    try {
      console.log("Checking session validity...");
      
      // Prepare headers with optional token
      const headers: HeadersInit = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      };
      
      // Add auth token if available
      const authToken = getAuthToken();
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
        console.log("Auth token found in storage, adding to request");
      }
      
      // Use the dedicated session check endpoint which doesn't return 401
      const response = await fetch("/api/session/check", {
        method: "GET",
        credentials: "include",
        headers
      });
      
      if (response.ok) {
        const sessionData = await response.json();
        console.log("Session check result:", sessionData);
        
        if (sessionData.authenticated) {
          console.log(`Session is valid via ${sessionData.authMethod || 'unknown'} auth`);
          
          // Since this endpoint doesn't return full user data, we need to fetch it separately
          // if we want to refresh the query cache
          try {
            // For the user data request, also include the token if available
            const userHeaders: HeadersInit = { 
              "Cache-Control": "no-cache, no-store, must-revalidate"
            };
            
            if (authToken) {
              userHeaders["Authorization"] = `Bearer ${authToken}`;
            }
            
            const userResponse = await fetch("/api/user", { 
              credentials: "include",
              headers: userHeaders
            });
            
            if (userResponse.ok) {
              const userData = await userResponse.json();
              console.log("User data fetched successfully:", userData?.username);
              queryClient.setQueryData(["/api/user"], userData);
            }
          } catch (userError) {
            console.error("Error fetching user data after session check:", userError);
          }
          
          return true;
        } else {
          console.log("Session is invalid - not authenticated");
          // Only clear user data if there's no valid token auth either
          if (!authToken) {
            queryClient.setQueryData(["/api/user"], null);
          }
          return false;
        }
      } else {
        console.log("Session check endpoint failed:", response.status);
        return false;
      }
    } catch (error) {
      console.error("Error checking session:", error);
      return false;
    }
  };

  // Periodically check session validity to maintain state
  useEffect(() => {
    const sessionCheckInterval = setInterval(() => {
      checkSession();
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    return () => clearInterval(sessionCheckInterval);
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log("Attempting login for user:", credentials.email);
      const res = await apiRequest("POST", "/api/login", credentials);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Login failed with status ${res.status}`);
      }
      
      const data = await res.json();
      console.log("Login response data:", {
        sessionId: data.sessionId,
        authStatus: data.authStatus,
        username: data.username,
        hasAuthToken: !!data.authToken
      });
      
      // Save auth token if provided in response
      if (data.authToken) {
        saveAuthToken(data.authToken);
        console.log("Token authentication available as backup");
      }
      
      // Return only the user data, stripping any session debug info
      const { sessionId, authStatus, authToken, ...user } = data;
      return user as SelectUser;
    },
    onSuccess: (user: SelectUser) => {
      console.log("Login successful, user data received:", user.email);
      queryClient.setQueryData(["/api/user"], user);
      
      // Show success toast immediately
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.firstName || user.email}!`,
      });
      
      // Redirect based on user role
      if (user.role === 'committee_chair' || user.role === 'committee_cochair') {
        setLocation("/committee-selection");
      } else if (user.role === 'admin') {
        setLocation("/admin");
      } else {
        setLocation("/");
      }
      
      // Verify session was properly created and cookies set in the background
      setTimeout(async () => {
        const isSessionValid = await checkSession();
        if (!isSessionValid) {
          console.warn("Session validation failed after login");
          // Force an explicit refetch
          await refetch();
        }
      }, 500);
    },
    onError: (error: Error) => {
      console.error("Login failed:", error);
      toast({
        title: "Login failed",
        description: error.message || "Please check your credentials and try again",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      console.log("Attempting registration for user:", credentials.email);
      const res = await apiRequest("POST", "/api/register", credentials);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Registration failed with status ${res.status}`);
      }
      
      const data = await res.json();
      console.log("Registration response data:", {
        sessionId: data.sessionId,
        authStatus: data.authStatus,
        email: data.email,
        username: data.username,
        hasAuthToken: !!data.authToken,
        hasValidData: data ? "Yes" : "No" 
      });
      
      // Save auth token if provided in response
      if (data.authToken) {
        saveAuthToken(data.authToken);
        console.log("Token authentication saved for backup auth");
      }
      
      // Return only the user data, stripping any session debug info
      const { sessionId, authStatus, authToken, ...user } = data;
      return user as SelectUser;
    },
    onSuccess: (user: SelectUser) => {
      console.log("Registration successful, user created:", user.email);
      
      // Immediately set the user data in cache to ensure it's available
      queryClient.setQueryData(["/api/user"], user);
      
      // Add a longer delay before verification to allow cookie propagation
      setTimeout(async () => {
        console.log("Verifying session after registration...");
        
        // Try multiple approaches to ensure the session is maintained
        let isSessionValid = false;
        
        // Get auth token if available
        const authToken = getAuthToken();
        
        // Prepare headers with token if available
        const headers: HeadersInit = {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        };
        
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
          console.log("Using auth token for post-registration validation");
        }
        
        // First check with the session check endpoint
        try {
          const response = await fetch("/api/session/check", {
            method: "GET",
            credentials: "include",
            headers
          });
          
          if (response.ok) {
            const sessionData = await response.json();
            console.log("Post-registration session check:", sessionData);
            isSessionValid = sessionData.authenticated;
          }
        } catch (error) {
          console.error("Session check error:", error);
        }
        
        // Then try /api/user as an additional verification
        if (!isSessionValid) {
          try {
            // Include token in this request too if available
            const userResponse = await fetch("/api/user", { 
              credentials: "include",
              headers
            });
            
            if (userResponse.ok) {
              const userData = await userResponse.json();
              console.log("Direct user fetch successful:", userData?.email);
              queryClient.setQueryData(["/api/user"], userData);
              isSessionValid = true;
            } else {
              console.log("User fetch failed with status:", userResponse.status);
            }
          } catch (error) {
            console.error("User fetch error:", error);
          }
        }
        
        // As a last resort, force refetch from React Query (which now includes token auth)
        if (!isSessionValid) {
          try {
            const refreshResult = await refetch();
            isSessionValid = !!refreshResult.data;
            console.log("User query refetch result:", isSessionValid ? "successful" : "failed");
          } catch (error) {
            console.error("Query refetch error:", error);
          }
        }
        
        // Now handle routing based on session validity
        if (isSessionValid) {
          console.log("Session validated, redirecting to onboarding");
          // The most important part - redirect to onboarding
          setLocation("/onboarding");
        } else {
          console.error("All session validation attempts failed after registration");
          // Show a toast with instructions in case of failure
          toast({
            title: "Session validation issue",
            description: "Please try refreshing the page to continue with onboarding",
            variant: "destructive",
          });
        }
      }, 500); // 500ms delay
      
      toast({
        title: "Registration successful",
        description: "Your account has been created. You'll be redirected to complete your profile.",
      });
    },
    onError: (error: Error) => {
      console.error("Registration failed:", error);
      toast({
        title: "Registration failed",
        description: error.message || "Please try using different credentials",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      console.log("Logging out user");
      await fetch("/api/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({})
      });
      console.log("Logout request sent");
      
      // Also clear the auth token
      clearAuthToken();
    },
    onSuccess: () => {
      console.log("Logout successful");
      queryClient.setQueryData(["/api/user"], null);
      // Clear all the query cache to avoid stale data
      queryClient.clear();
      // Redirect to auth page
      setLocation("/auth");
    },
    onError: (error: Error) => {
      console.error("Logout failed:", error);
      // Still clear the token even if server logout failed
      clearAuthToken();
      
      toast({
        title: "Logout failed",
        description: error.message || "An error occurred during logout",
        variant: "destructive",
      });
    },
  });

  // Admin-specific login mutation
  const adminLoginMutation = useMutation({
    mutationFn: async (credentials: AdminLoginData) => {
      console.log("Attempting admin login for user:", credentials.username);
      const res = await apiRequest("POST", "/api/admin/login", credentials);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Admin login failed with status ${res.status}`);
      }
      
      const data = await res.json();
      console.log("Admin login response data:", {
        sessionId: data.sessionId,
        authStatus: data.authStatus,
        username: data.username,
        hasAuthToken: !!data.authToken,
        portalType: data.portalType
      });
      
      // Save auth token if provided in response
      if (data.authToken) {
        saveAuthToken(data.authToken);
        console.log("Token authentication available as backup for admin login");
      }
      
      // Return only the user data, stripping any session debug info
      const { sessionId, authStatus, authToken, ...user } = data;
      return user as SelectUser;
    },
    onSuccess: (user: SelectUser) => {
      console.log("Admin login successful, user data received:", user.email);
      queryClient.setQueryData(["/api/user"], user);
      
      // Show success toast immediately
      toast({
        title: "Admin Login Successful",
        description: `Welcome back, ${user.firstName || user.email}!`,
      });
      
      // Redirect to admin dashboard
      setLocation("/admin");
      
      // Verify session was properly created and cookies set in the background
      setTimeout(async () => {
        const isSessionValid = await checkSession();
        if (!isSessionValid) {
          console.warn("Session validation failed after admin login");
          // Force an explicit refetch
          await refetch();
        }
      }, 500);
    },
    onError: (error: Error) => {
      console.error("Admin login failed:", error);
      toast({
        title: "Admin Login Failed",
        description: error.message || "Please check your credentials and try again",
        variant: "destructive",
      });
    },
  });
  
  // Member-specific login mutation
  const memberLoginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log("Attempting member login for user:", credentials.email);
      const res = await apiRequest("POST", "/api/member/login", credentials);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Member login failed with status ${res.status}`);
      }
      
      const data = await res.json();
      console.log("Member login response data:", {
        sessionId: data.sessionId,
        authStatus: data.authStatus,
        username: data.username,
        hasAuthToken: !!data.authToken,
        portalType: data.portalType
      });
      
      // Save auth token if provided in response
      if (data.authToken) {
        saveAuthToken(data.authToken);
        console.log("Token authentication available as backup for member login");
      }
      
      // Return only the user data, stripping any session debug info
      const { sessionId, authStatus, authToken, ...user } = data;
      return user as SelectUser;
    },
    onSuccess: (user: SelectUser) => {
      console.log("Member login successful, user data received:", user.email);
      console.log("User onboarding status:", user.hasCompletedOnboarding ? "Completed" : "Not completed");
      queryClient.setQueryData(["/api/user"], user);
      
      // Show success toast immediately
      toast({
        title: "Member Login Successful",
        description: `Welcome back, ${user.firstName || user.email}!`,
      });
      
      // Check if the user has completed onboarding
      if (user.hasCompletedOnboarding) {
        // If onboarding is complete, go to the main dashboard
        console.log("User has completed onboarding, redirecting to dashboard");
        setLocation("/");
      } else {
        // If onboarding is not complete, go to the onboarding page
        console.log("User has not completed onboarding, redirecting to onboarding page");
        setLocation("/onboarding");
      }
      
      // Verify session was properly created and cookies set in the background
      setTimeout(async () => {
        const isSessionValid = await checkSession();
        if (!isSessionValid) {
          console.warn("Session validation failed after member login");
          // Force an explicit refetch
          await refetch();
        }
      }, 500);
    },
    onError: (error: Error) => {
      console.error("Member login failed:", error);
      toast({
        title: "Member Login Failed",
        description: error.message || "Please check your credentials and try again",
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation, // Keep the generic login for backwards compatibility
        adminLoginMutation, // Add the admin-specific login
        memberLoginMutation, // Add the member-specific login
        logoutMutation,
        registerMutation,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
