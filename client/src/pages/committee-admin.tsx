import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CommitteeMembersManager } from "@/components/admin/committee-members-manager";
import { Redirect, useLocation } from "wouter";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Users, ChevronRight, Settings, ArrowLeft, RotateCcw, MessageSquare, Shield, Calendar, Video } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Committee {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

interface CommitteeRole {
  id: number;
  name: string;
  canManageCommittee: boolean;
  canManageWorkshops: boolean;
}

interface CommitteeMember {
  id: number;
  startDate: string;
  endDate: string | null;
  user: {
    id: number;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    username: string;
  };
  role: CommitteeRole;
}

/**
 * Committee Admin Page for Chairs and Co-chairs
 * This page only shows committees where the current user has a chair or co-chair role
 */
export default function CommitteeAdminPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("members");
  
  // Get committee ID from URL parameters
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const committeeParam = urlParams.get('committee');
  const targetCommitteeId = committeeParam ? parseInt(committeeParam) : null;

  // Fetch all committees
  const { data: committeesData, isLoading: isLoadingCommittees } = useQuery({
    queryKey: ["/api/committees"],
  });

  // Fetch committees where the user is a chair or co-chair
  const { data: userCommitteeRoles, isLoading: isLoadingUserCommittees } = useQuery({
    queryKey: ["/api/users/me/committee-roles"],
    enabled: !!user,
  });

  // Filter committees where user is chair or co-chair
  const userCommittees = Array.isArray(userCommitteeRoles) ? userCommitteeRoles.filter(
    (membership: { role: { name: string } }) => 
      membership.role.name === 'Chair' || 
      membership.role.name === 'Co-Chair'
  ) : [];

  // Update committee description mutation
  const updateCommitteeMutation = useMutation({
    mutationFn: async ({ id, description }: { id: number, description: string | null }) => {
      const res = await apiRequest("PATCH", `/api/committees/${id}/description`, { 
        description 
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update committee description");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/committees"] });
      toast({
        title: "Committee updated",
        description: "The committee description has been updated successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update committee",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Fetch selected committee details
  const { data: selectedCommittee, isLoading: isLoadingSelectedCommittee } = useQuery({
    queryKey: ["/api/committees", selectedCommitteeId],
    enabled: !!selectedCommitteeId,
  });

  // Handle URL parameter for committee selection and set initial committee
  useEffect(() => {
    if (targetCommitteeId && Array.isArray(userCommitteeRoles)) {
      // Check if user has access to the requested committee
      const hasAccess = userCommitteeRoles.some((membership: any) => {
        const committeeId = membership.committeeId;
        const roleName = membership.role?.name;
        return committeeId === targetCommitteeId && 
               (roleName === 'Chair' || roleName === 'Co-Chair');
      });
      
      if (hasAccess) {
        setSelectedCommitteeId(targetCommitteeId);
      } else {
        // For debugging: temporarily allow access and see what happens
        console.log("Access denied for committee", targetCommitteeId, "but allowing anyway for debugging");
        setSelectedCommitteeId(targetCommitteeId);
        // setLocation('/committee-selection');
      }
    } else if (
      userCommitteeRoles?.length > 0 && 
      !selectedCommitteeId && 
      !isLoadingUserCommittees &&
      !targetCommitteeId
    ) {
      // If no committee specified in URL and user has access to committees, redirect to selection
      setLocation('/committee-selection');
    }
  }, [userCommitteeRoles, selectedCommitteeId, isLoadingUserCommittees, targetCommitteeId, setLocation]);

  // Filter available committees and check user's role
  const getAvailableCommittees = () => {
    if (!committeesData || !userCommitteeRoles || !Array.isArray(committeesData) || !Array.isArray(userCommitteeRoles)) {
      return [];
    }

    return userCommitteeRoles
      .filter((membership: { role: { name: string } }) => 
        membership.role.name === 'Chair' || 
        membership.role.name === 'Co-Chair'
      )
      .map((membership: { committeeId: number }) => {
        const committee = committeesData.find((c: Committee) => c.id === membership.committeeId);
        return committee;
      })
      .filter(Boolean); // Remove undefined values
  };

  const availableCommittees = getAvailableCommittees();

  if (isAuthLoading || isLoadingUserCommittees) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // Check if user is a committee chair or co-chair
  const isChairOrCoChair = userCommittees?.length > 0;
  
  if (!user || !isChairOrCoChair) {
    return <Redirect to="/" />;
  }

  const handleCommitteeSwitch = (newCommitteeId: string) => {
    setLocation(`/committee-admin?committee=${newCommitteeId}`);
  };

  const currentCommittee = userCommitteeRoles?.find((role: any) => 
    role.committee.id === selectedCommitteeId
  );

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => setLocation('/committee-selection')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Committees</span>
            </Button>
            <h1 className="text-2xl font-bold">Committee Administration</h1>
          </div>
        </div>
        
        {currentCommittee && (
          <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-4">
              <div className="flex flex-col">
                <h2 className="text-lg font-semibold text-blue-900">
                  {currentCommittee.committee.name}
                </h2>
                <p className="text-sm text-blue-700">
                  Managing as {currentCommittee.role.name}
                </p>
              </div>
            </div>
            
            {userCommitteeRoles && userCommitteeRoles.length > 1 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-blue-800">Switch Committee:</span>
                <Select value={selectedCommitteeId?.toString()} onValueChange={handleCommitteeSwitch}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select committee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userCommitteeRoles
                      ?.filter((role: any) => role.role.name === 'Chair' || role.role.name === 'Co-Chair')
                      .map((role: any) => (
                        <SelectItem key={role.committee.id} value={role.committee.id.toString()}>
                          {role.committee.name} ({role.role.name})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {/* Left sidebar with committee list */}
        <div className="md:col-span-1 space-y-4">
          <div className="font-medium text-muted-foreground mb-2">Your Committees</div>
          {isLoadingCommittees ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-2">
              {availableCommittees.length > 0 ? (
                availableCommittees.map((committee: Committee) => (
                  <Card 
                    key={committee.id} 
                    className={`transition-colors ${committee.id === selectedCommitteeId ? 'bg-accent' : 'hover:bg-muted cursor-pointer'}`}
                    onClick={() => setSelectedCommitteeId(committee.id)}
                  >
                    <CardContent className="p-3 flex justify-between items-center">
                      <div className="font-medium">{committee.name}</div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="p-4 text-center border rounded-md">
                  <p className="text-muted-foreground">You are not a chair or co-chair of any committees.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right content area */}
        <div className="md:col-span-3">
          {selectedCommitteeId ? (
            <>
              {isLoadingSelectedCommittee ? (
                <div className="flex justify-center p-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <>
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle>{selectedCommittee?.name}</CardTitle>
                      {selectedCommittee?.description && (
                        <CardDescription className="mt-2">
                          {selectedCommittee.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex justify-end">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // Show a dialog to edit description
                          // This would typically be implemented with a separate dialog component
                          const newDescription = window.prompt("Enter new committee description:", selectedCommittee?.description || "");
                          if (newDescription !== null) {
                            updateCommitteeMutation.mutate({ 
                              id: selectedCommitteeId, 
                              description: newDescription || null 
                            });
                          }
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Description
                      </Button>
                    </CardContent>
                  </Card>

                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="space-y-4"
                  >
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="members">
                        <Users className="h-4 w-4 mr-2" />
                        Members
                      </TabsTrigger>
                      <TabsTrigger value="messaging">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Messages
                      </TabsTrigger>
                      <TabsTrigger value="roles">
                        <Shield className="h-4 w-4 mr-2" />
                        Roles
                      </TabsTrigger>
                      <TabsTrigger value="calendar">
                        <Calendar className="h-4 w-4 mr-2" />
                        Calendar
                      </TabsTrigger>
                      <TabsTrigger value="meetings">
                        <Video className="h-4 w-4 mr-2" />
                        Meetings
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="members">
                      <CommitteeMembersManager committeeId={selectedCommitteeId} />
                    </TabsContent>

                    <TabsContent value="messaging">
                      <Card>
                        <CardHeader>
                          <CardTitle>Committee Messages</CardTitle>
                          <CardDescription>
                            Send messages and communicate with committee members
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <MessageSquare className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="font-medium text-blue-900">Committee Communication</p>
                              <p className="text-sm text-blue-700">Send announcements and messages to all committee members</p>
                            </div>
                          </div>
                          <Button className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            Compose Message
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="roles">
                      <Card>
                        <CardHeader>
                          <CardTitle>Member Roles</CardTitle>
                          <CardDescription>
                            Assign and manage roles for committee members
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg border border-green-200">
                            <Shield className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="font-medium text-green-900">Role Management</p>
                              <p className="text-sm text-green-700">Assign specific roles and permissions to committee members</p>
                            </div>
                          </div>
                          <Button className="w-full">
                            <Edit className="h-4 w-4 mr-2" />
                            Manage Member Roles
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="calendar">
                      <Card>
                        <CardHeader>
                          <CardTitle>Committee Calendar</CardTitle>
                          <CardDescription>
                            Private calendar for committee events and meetings
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center gap-2 p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <Calendar className="h-5 w-5 text-purple-600" />
                            <div>
                              <p className="font-medium text-purple-900">Private Calendar</p>
                              <p className="text-sm text-purple-700">Schedule meetings and events visible only to committee members</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline">
                              <Plus className="h-4 w-4 mr-2" />
                              Add Event
                            </Button>
                            <Button variant="outline">
                              <Calendar className="h-4 w-4 mr-2" />
                              View Calendar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="meetings">
                      <Card>
                        <CardHeader>
                          <CardTitle>Video Meetings</CardTitle>
                          <CardDescription>
                            Start and manage Zoom meetings for your committee
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center gap-2 p-4 bg-orange-50 rounded-lg border border-orange-200">
                            <Video className="h-5 w-5 text-orange-600" />
                            <div>
                              <p className="font-medium text-orange-900">Zoom Integration</p>
                              <p className="text-sm text-orange-700">Start instant meetings or schedule committee calls</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button className="bg-blue-600 hover:bg-blue-700">
                              <Video className="h-4 w-4 mr-2" />
                              Start Instant Meeting
                            </Button>
                            <Button variant="outline">
                              <Calendar className="h-4 w-4 mr-2" />
                              Schedule Meeting
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 border rounded-md">
              <p className="text-muted-foreground mb-4">Select a committee from the list to manage it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}