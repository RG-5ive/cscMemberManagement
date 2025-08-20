import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, UserCheck, UserPlus, Info } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MemberSearchResult {
  id: number;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  province: string;
  category: string;
  isActive: boolean;
  isRegistered?: boolean;
  user: User | null;
}

interface AddWorkshopParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshopId: number;
  onParticipantAdded: () => void;
  remainingCapacity: number;
}

export default function AddWorkshopParticipantDialog({
  open,
  onOpenChange,
  workshopId,
  onParticipantAdded,
  remainingCapacity
}: AddWorkshopParticipantDialogProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [searchTab, setSearchTab] = useState<string>("users");
  
  // Search users query
  const { data: userSearchResults, isLoading: userSearchLoading, refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ["/api/users/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      const response = await apiRequest("GET", `/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error("Failed to search users");
      }
      return response.json();
    },
    enabled: searchQuery.length >= 2 && searchTab === "users",
    refetchOnWindowFocus: false,
  });
  
  // Get current registrations to filter out already registered members
  const { data: currentRegistrations } = useQuery<any[]>({
    queryKey: [`/api/workshops/${workshopId}/registrations`],
    refetchOnWindowFocus: false,
  });

  // Search members query with improved implementation
  const { data: memberSearchResults, isLoading: memberSearchLoading, refetch: refetchMembers } = useQuery<MemberSearchResult[]>({
    queryKey: ["/api/members/search", searchQuery, workshopId],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      // Add debug log to see if this is being called
      console.log(`Searching members with query: ${searchQuery}`);
      
      try {
        // First try the regular search endpoint
        const response = await apiRequest("GET", `/api/members/search?query=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          console.log("Member search response:", data);
          
          // Get currently registered user IDs
          const registeredUserIds = currentRegistrations?.map(reg => reg.userId) || [];
          console.log("Currently registered user IDs:", registeredUserIds);
          
          // Filter out members that are already registered
          let members = data.members || data;
          
          // If we have registration data, show registration status for members
          if (registeredUserIds.length > 0) {
            members = members.map((member: MemberSearchResult) => {
              // Check if this member is already registered through their user account
              const isRegistered = member.user && registeredUserIds.includes(member.user.id);
              return {
                ...member,
                isRegistered: !!isRegistered
              };
            });
          }
          
          return members;
        }
        
        // If that fails, try the generic members endpoint with a search parameter
        console.log("Falling back to /api/members with search parameter");
        const fallbackResponse = await apiRequest("GET", `/api/members?search=${encodeURIComponent(searchQuery)}`);
        if (!fallbackResponse.ok) {
          throw new Error("Failed to search members");
        }
        
        const fallbackData = await fallbackResponse.json();
        console.log("Fallback member search response:", fallbackData);
        
        // Process the members data to include user account info
        const membersWithUserInfo = fallbackData.members.map((member: any) => ({
          ...member,
          user: null, // We don't have user info in this fallback
          isActive: member.status !== 'Inactive',
          isRegistered: false // We don't know registration status in fallback mode
        }));
        
        return membersWithUserInfo;
      } catch (error) {
        console.error("Error searching members:", error);
        throw new Error("Failed to search members");
      }
    },
    enabled: searchQuery.length >= 2 && searchTab === "members",
    refetchOnWindowFocus: false,
  });
  
  // Add participant mutation
  const addParticipantMutation = useMutation({
    mutationFn: async (userId: number) => {
      // API route is /api/workshops/:id/add-participant (needs to match server endpoint param name)
      const response = await apiRequest("POST", `/api/workshops/${workshopId}/add-participant`, { userId });
      if (!response.ok) {
        // Log the error details for debugging
        console.error("Error adding participant:", await response.clone().text());
        const error = await response.json().catch(() => ({ error: "Failed to parse error response" }));
        throw new Error(error.error || "Failed to add participant");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Participant Added",
        description: "Successfully added participant to the workshop",
      });
      onParticipantAdded();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Participant",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (searchQuery.length >= 2) {
      if (searchTab === "users") {
        refetchUsers();
      } else {
        refetchMembers();
      }
    }
  };

  const handleSelectUser = (userId: number) => {
    setSelectedUserId(userId);
    setSelectedMemberId(null);
  };

  const handleSelectMember = (memberId: number, hasUser: boolean, userId?: number | null, isRegistered?: boolean) => {
    // If the member is already registered, don't allow them to be selected
    if (isRegistered) {
      toast({
        title: "Already Registered",
        description: "This member is already registered for this workshop",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedMemberId(memberId);
    setSelectedUserId(userId || null);
  };

  const handleAddParticipant = async () => {
    if (selectedUserId) {
      try {
        console.log(`Attempting to add user ${selectedUserId} to workshop ${workshopId}`);
        await addParticipantMutation.mutateAsync(selectedUserId);
      } catch (error) {
        console.error("Error in handleAddParticipant:", error);
        // Error is already handled in mutation's onError
      }
    } else if (selectedMemberId) {
      try {
        // We're selecting a member directly, attempt to add them to the workshop
        console.log(`Attempting to add member ${selectedMemberId} to workshop ${workshopId}`);
        
        // We need to add this member to the workshop by creating a temporary auto-generated user
        // account for them for tracking in the system (if they don't already have one)
        const response = await apiRequest("POST", `/api/workshops/${workshopId}/add-member`, { 
          memberId: selectedMemberId 
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || "Failed to add member to workshop");
        }
        
        const result = await response.json();
        toast({
          title: "Member Added",
          description: result.message || "Successfully added member to the workshop",
        });
        
        onParticipantAdded();
      } catch (error) {
        console.error("Error adding member to workshop:", error);
        toast({
          title: "Failed to Add Member",
          description: error instanceof Error ? error.message : "There was an error adding the member to the workshop",
          variant: "destructive",
        });
      }
    }
  };

  const resetState = () => {
    setSearchQuery("");
    setSelectedUserId(null);
    setSelectedMemberId(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) resetState();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Workshop Participant</DialogTitle>
        </DialogHeader>
        
        {remainingCapacity <= 0 ? (
          <div className="text-center py-4">
            <p className="text-destructive font-medium">
              Workshop is at full capacity. Cannot add more participants.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <Tabs defaultValue="users" onValueChange={setSearchTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="users">Search Users</TabsTrigger>
                  <TabsTrigger value="members">Search Members</TabsTrigger>
                </TabsList>
                
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder={searchTab === "users" ? "Search users by name or email" : "Search members by name, email, or member number"}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      autoFocus={false}
                      onFocus={(e) => {
                        // Prevent auto-selection by immediately setting selection range to end
                        const value = e.target.value;
                        requestAnimationFrame(() => {
                          e.target.setSelectionRange(value.length, value.length);
                        });
                      }}
                    />
                    <Button 
                      type="button" 
                      onClick={handleSearch}
                      variant="outline"
                      disabled={searchQuery.length < 2}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enter at least 2 characters to search
                  </p>
                </div>

                <TabsContent value="users" className="space-y-4 mt-2">
                  {userSearchLoading && (
                    <div className="flex justify-center py-4">
                      <LoadingSpinner size="md" />
                    </div>
                  )}

                  {!userSearchLoading && userSearchResults && userSearchResults.length === 0 && searchQuery.length >= 2 && (
                    <div className="text-center py-4 border rounded-lg bg-muted/20">
                      <p className="text-muted-foreground">No users found</p>
                    </div>
                  )}

                  {!userSearchLoading && userSearchResults && userSearchResults.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="max-h-[300px] overflow-y-auto">
                        {userSearchResults.map((user: User) => (
                          <div
                            key={user.id}
                            className={`p-3 flex justify-between items-center cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${
                              selectedUserId === user.id ? "bg-primary/10" : ""
                            }`}
                            onClick={() => handleSelectUser(user.id)}
                          >
                            <div>
                              <div className="font-medium">
                                {user.firstName || ""} {user.lastName || ""}
                                {user.role === "admin" && (
                                  <Badge variant="outline" className="ml-2 text-xs">Admin</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {user.email}
                              </div>
                            </div>
                            {selectedUserId === user.id && (
                              <UserCheck className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="members" className="space-y-4 mt-2">
                  {memberSearchLoading && (
                    <div className="flex justify-center py-4">
                      <LoadingSpinner size="md" />
                    </div>
                  )}

                  {!memberSearchLoading && memberSearchResults && memberSearchResults.length === 0 && searchQuery.length >= 2 && (
                    <div className="text-center py-4 border rounded-lg bg-muted/20">
                      <p className="text-muted-foreground">No members found</p>
                    </div>
                  )}

                  {!memberSearchLoading && memberSearchResults && memberSearchResults.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="max-h-[300px] overflow-y-auto">
                        {memberSearchResults.map((member: MemberSearchResult) => (
                          <div
                            key={member.id}
                            className={`p-3 flex justify-between items-center cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${
                              selectedMemberId === member.id ? "bg-primary/10" : ""
                            }`}
                            onClick={() => handleSelectMember(member.id, !!member.user, member.user?.id, member.isRegistered)}
                          >
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {member.firstName} {member.lastName}
                                {!member.isActive && (
                                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">Inactive</Badge>
                                )}
                                {member.isRegistered && (
                                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 text-xs">Already Registered</Badge>
                                )}
                                <Badge className="text-xs">{member.category}</Badge>
                                <Badge variant="outline" className="text-xs">{member.province || "N/A"}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {member.email} 
                                <span className="mx-1">•</span> 
                                <span>Member #{member.memberNumber}</span>
                              </div>
                              <div className="mt-1">
                                {member.user ? (
                                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                                    Has User Account
                                  </Badge>
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                                          <Info className="h-3 w-3 mr-1" />
                                          No User Account
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="w-[200px] text-xs">
                                          This member does not have a user account. They need to register with the same email address.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </div>
                            {selectedMemberId === member.id && (
                              <UserCheck className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter className="flex items-center justify-between">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddParticipant}
                disabled={(!selectedUserId && !selectedMemberId) || addParticipantMutation.isPending}
              >
                {addParticipantMutation.isPending ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Adding...</span>
                  </>
                ) : (
                  "Add Participant"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}