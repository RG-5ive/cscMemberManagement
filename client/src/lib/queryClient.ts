import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Try to parse JSON first
    try {
      const errorData = await res.json();
      if (errorData.error) {
        throw new Error(errorData.error);
      }
    } catch (parseError) {
      // If JSON parsing fails, fallback to text
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status}: ${text || 'Unknown error'}`);
    }
    
    // If we got here without throwing, throw a generic error
    throw new Error(`Request failed with status ${res.status}`);
  }
}

// Helper function to get auth token from localStorage
// This must match the AUTH_TOKEN_KEY in use-auth.tsx
function getAuthToken(): string | null {
  return localStorage.getItem('csc_auth_token');
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    console.log(`Making ${method} request to ${url}`);
    
    // Prepare headers for session-based auth with token fallback
    const headers: HeadersInit = {};
    if (data && method !== 'GET') {
      headers["Content-Type"] = "application/json";
    }
    
    // Add auth token if available as fallback
    const authToken = getAuthToken();
    if (authToken) {
      console.log(`Auth token found in storage, adding to request`);
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Essential for session-based auth
    });

    console.log(`Request ${method} ${url} returned status: ${res.status}`);
    
    if (!res.ok) {
      await throwIfResNotOk(res);
    }
    
    return res;
  } catch (error) {
    console.error(`API request failed: ${method} ${url}`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      console.log(`Making query request to ${queryKey[0]}`);
      
      // Prepare headers for session-based auth with token fallback
      const headers: HeadersInit = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };
      
      // Add auth token if available as fallback
      const authToken = getAuthToken();
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
        headers
      });

      if (res.status === 401) {
        console.log(`Received 401 Unauthorized from ${queryKey[0]}`);
        if (unauthorizedBehavior === "returnNull") {
          console.log('Returning null due to unauthorized behavior setting');
          return null;
        }
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      console.log(`Query data received from ${queryKey[0]}:`, data ? 'Data present' : 'No data');
      
      // Special logging for statistics endpoint
      if (queryKey[0] === "/api/members/statistics") {
        console.log('Statistics data summary:', {
          totalCount: data?.totalCount,
          membersLength: data?.members?.length,
          accessLevel: data?.accessLevel
        });
      }
      
      return data;
    } catch (error) {
      console.error(`Query error for ${queryKey[0]}:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true, // Enable refetch on window focus for better session checking
      staleTime: 30000, // 30 seconds - balance between performance and freshness
      retry: 1, // Allow one retry for transient issues
      retryDelay: attempt => Math.min(1000 * attempt, 3000), // Exponential backoff with a cap
    },
    mutations: {
      retry: 1, // Allow one retry for important operations like login/register
    },
  },
});
