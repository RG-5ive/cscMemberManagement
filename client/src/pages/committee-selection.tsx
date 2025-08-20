import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useLocation } from "wouter";
import { Users, Calendar, Settings } from "lucide-react";

interface CommitteeRole {
  id: number;
  committeeId: number;
  startDate: string;
  endDate: string | null;
  committee: {
    id: number;
    name: string;
    description: string | null;
  };
  role: {
    id: number;
    name: string;
    description: string | null;
  };
}

export default function CommitteeSelectionPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: committeeRoles, isLoading, error } = useQuery<CommitteeRole[]>({
    queryKey: ["/api/users/me/committee-roles"],
    enabled: !!user,
  });

  // Debug logging
  console.log("Committee Selection Page - Debug Info:");
  console.log("User:", user);
  console.log("IsLoading:", isLoading);
  console.log("Error:", error);
  console.log("Committee Roles Data:", committeeRoles);
  console.log("Committee Roles Length:", committeeRoles?.length);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Committees</h1>
          <p className="text-muted-foreground">
            Unable to load your committee assignments. Please try again or contact support.
          </p>
        </div>
      </div>
    );
  }

  if (!committeeRoles || committeeRoles.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Committee Assignments</h1>
          <p className="text-muted-foreground">
            You are not currently assigned to manage any committees. Please contact an administrator if this is incorrect.
          </p>
        </div>
      </div>
    );
  }

  const handleCommitteeSelect = (committeeId: number) => {
    console.log("Committee selected:", committeeId);
    console.log("Navigating to:", `/committee-admin?committee=${committeeId}`);
    
    // Try both approaches - wouter navigation and direct window navigation
    try {
      setLocation(`/committee-admin?committee=${committeeId}`);
      
      // If wouter doesn't work, try direct navigation as fallback
      setTimeout(() => {
        if (window.location.pathname !== '/committee-admin') {
          console.log("Wouter navigation failed, trying direct navigation");
          window.location.href = `/committee-admin?committee=${committeeId}`;
        }
      }, 100);
    } catch (error) {
      console.error("Navigation error:", error);
      window.location.href = `/committee-admin?committee=${committeeId}`;
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Committee Management Portal</h1>
        <p className="text-muted-foreground">
          Welcome, {user?.firstName || user?.username}. Select a committee to manage.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {committeeRoles.map((committeeRole) => (
          <Card key={committeeRole.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{committeeRole.committee.name}</CardTitle>
                <Badge variant={committeeRole.role.name === 'Chair' ? 'default' : 'secondary'}>
                  {committeeRole.role.name}
                </Badge>
              </div>
              {committeeRole.committee.description && (
                <CardDescription>{committeeRole.committee.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Started: {new Date(committeeRole.startDate).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Role: {committeeRole.role.description || committeeRole.role.name}</span>
                </div>

                <Button 
                  onClick={() => handleCommitteeSelect(committeeRole.committee.id)}
                  className="w-full"
                  variant="default"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Committee
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {committeeRoles.length > 1 && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Multiple Committees:</strong> You manage {committeeRoles.length} committees. 
            You can switch between them at any time from the committee management interface.
          </p>
        </div>
      )}
    </div>
  );
}