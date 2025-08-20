import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AntiSelectInput } from "@/components/ui/anti-select-input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Trash2, Edit, Plus, Calendar, Key } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ChairCredentialsDialog } from "./chair-credentials-dialog";

interface Committee {
  id: number;
  name: string;
  description: string | null;
}

interface CommitteeRole {
  id: number;
  name: string;
  canManageCommittee: boolean;
  canManageWorkshops: boolean;
}

interface User {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  username: string;
  // For nested users in search results
  user?: User | null;
}

interface CommitteeMember {
  id: number;
  startDate: string;
  endDate: string | null;
  user: {
    id: number;
    firstName?: string | null;
    lastName?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email: string;
    username: string;
  };
  role: {
    id: number;
    name: string;
    canManageCommittee: boolean;
    canManageWorkshops: boolean;
  };
}

interface CommitteeMembersManagerProps {
  committeeId: number;
  committeeName?: string;
}

export function CommitteeMembersManager({ committeeId, committeeName }: CommitteeMembersManagerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [isEditMemberDialogOpen, setIsEditMemberDialogOpen] = useState(false);
  const [isRemoveMemberDialogOpen, setIsRemoveMemberDialogOpen] = useState(false);
  const [isCredentialsDialogOpen, setIsCredentialsDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CommitteeMember | null>(null);
  const [searchInputValue, setSearchInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [newMember, setNewMember] = useState({
    userId: 0,
    roleId: 0,
    startDate: new Date(),
    endDate: null as Date | null
  });
  
  // Check if user is admin (can assign Chair/Co-chair)
  const isAdmin = user?.role === 'admin';
  
  // Debounce search term updates to prevent constant refreshing
  const searchDebounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Fetch committee data
  const { data: committeeData, isLoading: isCommitteeLoading } = useQuery({
    queryKey: ["/api/committees", committeeId],
    enabled: !!committeeId,
  });

  // Fetch committee members
  const { data: members, isLoading: isMembersLoading, error: membersError } = useQuery({
    queryKey: [`/api/committees/${committeeId}/members`],
    enabled: !!committeeId,
  });

  // Fetch committee roles
  const { data: roles, isLoading: isRolesLoading } = useQuery({
    queryKey: ["/api/committee-roles"],
  });

  // Fetch all users for reference
  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ["/api/users"],
  });

  // Dynamic search for members with autocomplete
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["/api/members/search", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      
      try {
        // First try to search using the comprehensive member search endpoint
        console.log(`Searching members with query: ${searchTerm}`);
        const response = await apiRequest("GET", `/api/members/search?query=${encodeURIComponent(searchTerm)}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log("Member search response:", data);
          
          // Process the data to get consistent format
          let members = data.members || data;
          return members;
        } else {
          throw new Error("Failed to search members");
        }
      } catch (memberError) {
        console.error("Error searching members:", memberError);
        
        // Fall back to user search if member search fails
        try {
          console.log("Falling back to user search");
          const userResponse = await apiRequest("GET", `/api/users/search?q=${encodeURIComponent(searchTerm)}`);
          if (!userResponse.ok) {
            throw new Error("Failed to search users");
          }
          return await userResponse.json();
        } catch (userError) {
          console.error("Error in fallback user search:", userError);
          return [];
        }
      }
    },
    enabled: searchTerm.length >= 2,
    refetchOnWindowFocus: false,
  });

  // Update filtered users when search results change
  useEffect(() => {
    if (searchResults && Array.isArray(searchResults)) {
      // Map the search results to a consistent format, but preserve the original member data
      const mappedUsers = searchResults.map((result: any) => {
        // If this is a member with a user account
        if (result.user) {
          // Keep the original member data and include the user info
          return {
            ...result,
            // This ensures we still have the needed user properties at the top level
            // for display in the dropdown
            id: result.user.id,
            firstName: result.user.firstName || result.user.first_name,
            lastName: result.user.lastName || result.user.last_name,
            email: result.user.email,
            username: result.user.username || result.user.email,
            user: result.user // Original user data preserved
          };
        }
        
        // For members without user accounts, create a user-like object from the member data
        return {
          ...result, // Keep all original member data
          id: result.id,
          firstName: result.firstName || result.first_name,
          lastName: result.lastName || result.last_name,
          email: result.email,
          username: result.email, // Use email as username for display
          user: null // Explicitly mark as having no user account
        };
      });
      
      console.log("Processed search results into:", mappedUsers);
      setFilteredUsers(mappedUsers);
    } else {
      setFilteredUsers([]);
    }
  }, [searchResults, searchTerm]);

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (data: typeof newMember) => {
      console.log("Adding committee member with data:", data);
      
      // Create the request payload
      const payload = {
        userId: data.userId,
        roleId: data.roleId,
        startDate: data.startDate ? data.startDate.toISOString() : new Date().toISOString(),
        endDate: data.endDate ? data.endDate.toISOString() : null
      };
      
      console.log("Sending API request with payload:", payload);
      
      const res = await apiRequest("POST", `/api/committees/${committeeId}/members`, payload);
      
      console.log("API response status:", res.status);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error("API error response:", errorData);
        throw new Error(errorData.error || "Failed to add member");
      }
      
      const result = await res.json();
      console.log("API success response:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("Committee member added successfully:", data);
      
      // Invalidate both the committee members list and the committee itself
      queryClient.invalidateQueries({ queryKey: [`/api/committees/${committeeId}/members`] });
      queryClient.invalidateQueries({ queryKey: [`/api/committees/${committeeId}`] });
      
      // Also refetch the broader committees list
      queryClient.invalidateQueries({ queryKey: ['/api/committees'] });
      
      setIsAddMemberDialogOpen(false);
      resetNewMember();
      toast({
        title: "Member added",
        description: "The member has been added to the committee successfully."
      });
    },
    onError: (error: Error) => {
      console.error("Failed to add committee member:", error);
      toast({
        title: "Failed to add member",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update member mutation
  const updateMemberMutation = useMutation({
    mutationFn: async (data: { memberId: number; roleId: number; endDate: Date | null }) => {
      const res = await apiRequest("PUT", `/api/committees/${committeeId}/members/${data.memberId}`, {
        roleId: data.roleId,
        endDate: data.endDate
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update member");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/committees/${committeeId}/members`] });
      setIsEditMemberDialogOpen(false);
      setSelectedMember(null);
      toast({
        title: "Member updated",
        description: "The committee member has been updated successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update member",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      const res = await apiRequest("DELETE", `/api/committees/${committeeId}/members/${memberId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to remove member");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/committees/${committeeId}/members`] });
      setIsRemoveMemberDialogOpen(false);
      setSelectedMember(null);
      toast({
        title: "Member removed",
        description: "The member has been removed from the committee."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove member",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Effect to debounce search changes
  useEffect(() => {
    // Add debounced search effect
    if (searchInputValue.length >= 2) {
      // Clear any existing timeout
      if (searchDebounceTimeout.current) {
        clearTimeout(searchDebounceTimeout.current);
      }
      
      // Set a new timeout to update searchTerm after delay
      searchDebounceTimeout.current = setTimeout(() => {
        setSearchTerm(searchInputValue);
      }, 500); // 500ms delay before triggering search
    } else if (searchInputValue.length === 0) {
      // If input is cleared, also clear search term immediately
      setSearchTerm("");
    }
    
    // Cleanup on unmount
    return () => {
      if (searchDebounceTimeout.current) {
        clearTimeout(searchDebounceTimeout.current);
      }
    };
  }, [searchInputValue]);

  // Reset new member form
  const resetNewMember = () => {
    setNewMember({
      userId: 0,
      roleId: 0,
      startDate: new Date(),
      endDate: null
    });
    setSearchInputValue("");
    setSearchTerm("");
    setFilteredUsers([]);
  };

  // Handle user selection
  const handleSelectUser = (userOrMember: any) => {
    // Log what we received to help with debugging
    console.log("Selected user/member:", userOrMember);
    
    // If this is a member without a user account, we need to create one first
    if (userOrMember.user === null && userOrMember.email) {
      // Show information about this scenario
      toast({
        title: "User account required",
        description: "This member needs a user account before they can be added to a committee.",
        variant: "destructive"
      });
      return;
    }
    
    // Get the user ID - either directly or from the user object
    const userId = userOrMember.user ? userOrMember.user.id : userOrMember.id;
    
    if (!userId) {
      toast({
        title: "Invalid selection",
        description: "Could not determine user ID from selection.",
        variant: "destructive"
      });
      return;
    }
    
    console.log(`Setting new member with userId: ${userId}`);
    setNewMember({ ...newMember, userId });
    setSearchTerm("");
    setFilteredUsers([]);
  };

  // Handle role selection
  const handleSelectRole = (roleId: string) => {
    setNewMember({ ...newMember, roleId: parseInt(roleId) });
  };

  // Handle edit member
  const handleEditMember = (member: CommitteeMember) => {
    setSelectedMember(member);
    setIsEditMemberDialogOpen(true);
  };

  // Handle remove member
  const handleRemoveMember = (member: CommitteeMember) => {
    setSelectedMember(member);
    setIsRemoveMemberDialogOpen(true);
  };
  
  // Handle setting credentials for Chair/Co-chair
  const handleSetCredentials = (member: CommitteeMember) => {
    setSelectedMember(member);
    setIsCredentialsDialogOpen(true);
  };

  // Add member handler
  const handleAddMember = () => {
    console.log("Add Member button clicked with newMember:", newMember);
    
    if (newMember.userId && newMember.roleId) {
      console.log("Validation passed, submitting member with userId:", newMember.userId, "and roleId:", newMember.roleId);
      
      // Create a copy of the newMember to ensure we're not mutating the state
      const memberToAdd = { ...newMember };
      
      // Submit the mutation
      addMemberMutation.mutate(memberToAdd);
      
      // Force refetch after a small delay to ensure the server has processed the request
      setTimeout(() => {
        console.log("Performing delayed refetch of committee members");
        queryClient.invalidateQueries({ queryKey: [`/api/committees/${committeeId}/members`] });
      }, 1000);
    } else {
      console.warn("Validation failed - missing required fields:", 
        !newMember.userId ? "userId is missing" : "",
        !newMember.roleId ? "roleId is missing" : ""
      );
      
      toast({
        title: "Missing information",
        description: "Please select a user and a role.",
        variant: "destructive"
      });
    }
  };

  // Update member handler
  const handleUpdateMember = () => {
    if (selectedMember) {
      updateMemberMutation.mutate({
        memberId: selectedMember.id,
        roleId: selectedMember.role.id,
        endDate: selectedMember.endDate ? new Date(selectedMember.endDate) : null
      });
    }
  };

  // Remove member handler
  const handleConfirmRemove = () => {
    if (selectedMember) {
      removeMemberMutation.mutate(selectedMember.id);
    }
  };

  const isLoading = isCommitteeLoading || isMembersLoading || isRolesLoading || isUsersLoading;
  
  // Include search loading state in the component loading state if there's a search term
  const isComponentLoading = isLoading || (searchTerm.length >= 2 && isSearching);

  if (isComponentLoading) {
    return (
      <div className="flex justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (membersError) {
    return (
      <div className="text-destructive p-4">
        Error loading committee members: {(membersError as Error).message}
      </div>
    );
  }

  // Format the member's name for display
  const formatMemberName = (user: User | null) => {
    // Handle null case
    if (!user) return "Unknown Member";
    
    // Handle different property name formats (camelCase or snake_case)
    const firstName = user.firstName || user.first_name || "";
    const lastName = user.lastName || user.last_name || "";
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    } else {
      return user.username || user.email || "Unnamed User";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>
            {committeeName ? `${committeeName} Members` : "Committee Members"}
          </CardTitle>
          {committeeData?.description && (
            <p className="text-sm text-muted-foreground mt-1">{committeeData.description}</p>
          )}
        </div>
        <Button onClick={() => setIsAddMemberDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Member
        </Button>
      </CardHeader>
      <CardContent>
        {members && Array.isArray(members) && members.length > 0 ? (
          <div className="grid gap-4">
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-left font-medium">Name</th>
                    <th className="p-3 text-left font-medium">Email</th>
                    <th className="p-3 text-left font-medium">Role</th>
                    <th className="p-3 text-left font-medium">Start Date</th>
                    <th className="p-3 text-left font-medium">End Date</th>
                    <th className="p-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(members) && members.map((member: CommitteeMember) => (
                    <tr key={member.id} className="border-b">
                      <td className="p-3">{formatMemberName(member.user)}</td>
                      <td className="p-3">{member.user.email}</td>
                      <td className="p-3">{member.role.name}</td>
                      <td className="p-3">
                        {new Date(member.startDate).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        {member.endDate ? new Date(member.endDate).toLocaleDateString() : "-"}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditMember(member)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {/* Set Credentials button only for Chair/Co-Chair and only for admins */}
                          {isAdmin && (member.role.name === 'Chair' || member.role.name === 'Co-Chair') && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleSetCredentials(member)}
                              title="Set Login Credentials"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleRemoveMember(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center p-4 text-muted-foreground">
            No members in this committee. Add members to get started.
          </div>
        )}
      </CardContent>

      {/* Add Member Dialog */}
      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Committee Member</DialogTitle>
            <DialogDescription>
              Add a new member to the committee
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="user-search">Search User</Label>
              <div className="relative">
                <div className="relative">
                  <Input
                    id="user-search"
                    value={searchInputValue}
                    onChange={(e) => setSearchInputValue(e.target.value)}
                    placeholder="Search by name or email"
                    className="w-full"
                    autoComplete="off"
                    spellCheck="false"
                    autoFocus={false}
                  />
                  {isSearching && searchTerm.length >= 2 && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <LoadingSpinner size="sm" />
                    </div>
                  )}
                </div>
                
                {searchInputValue.length < 2 && searchInputValue.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1 ml-1">
                    Type at least 2 characters to search
                  </div>
                )}
                
                {searchTerm.length >= 2 && !isSearching && filteredUsers.length === 0 && (
                  <div className="text-sm text-muted-foreground mt-2 p-2 border rounded-md">
                    No users found matching "{searchInputValue}"
                  </div>
                )}
                
                {filteredUsers.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="p-2 hover:bg-accent cursor-pointer"
                        onClick={() => handleSelectUser(user)}
                      >
                        <div className="font-medium">
                          {formatMemberName(user)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {user.email}
                          {user.user && <span className="ml-2 text-xs bg-green-100 text-green-800 py-0.5 px-1.5 rounded">Has Account</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {newMember.userId > 0 && usersData && Array.isArray(usersData) && (
                <div className="mt-2 p-2 border rounded-md">
                  <div className="font-medium">
                    {formatMemberName(usersData.find((u: User) => u.id === newMember.userId) || { id: 0, firstName: '', lastName: '', email: '', username: '' })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {usersData.find((u: User) => u.id === newMember.userId)?.email || ''}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newMember.roleId.toString()}
                onValueChange={handleSelectRole}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles && Array.isArray(roles) && roles
                    .filter((role: CommitteeRole) => {
                      // Non-admin users can't assign Chair or Co-Chair roles
                      if (!isAdmin && (role.name === 'Chair' || role.name === 'Co-Chair')) {
                        return false;
                      }
                      return true;
                    })
                    .map((role: CommitteeRole) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.name}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="start-date"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {newMember.startDate ? (
                      format(newMember.startDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={newMember.startDate}
                    onSelect={(date) =>
                      setNewMember({ ...newMember, startDate: date || new Date() })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="end-date">End Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="end-date"
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {newMember.endDate ? (
                      format(newMember.endDate, "PPP")
                    ) : (
                      <span>No end date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={newMember.endDate || undefined}
                    onSelect={(date) =>
                      setNewMember({ ...newMember, endDate: date || null })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {newMember.endDate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewMember({ ...newMember, endDate: null })}
                >
                  Clear End Date
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAddMemberDialogOpen(false);
              resetNewMember();
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={!newMember.userId || !newMember.roleId || addMemberMutation.isPending}
            >
              {addMemberMutation.isPending ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={isEditMemberDialogOpen} onOpenChange={setIsEditMemberDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Committee Member</DialogTitle>
            <DialogDescription>
              Update member role or end date
            </DialogDescription>
          </DialogHeader>

          {selectedMember && (
            <div className="grid gap-4 py-4">
              <div className="p-3 border rounded-md">
                <p className="font-medium">{formatMemberName(selectedMember.user)}</p>
                <p className="text-sm text-muted-foreground">{selectedMember.user.email}</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={selectedMember.role.id.toString()}
                  onValueChange={(value) => {
                    const roleId = parseInt(value);
                    const role = roles.find((r: CommitteeRole) => r.id === roleId);
                    if (role) {
                      setSelectedMember({
                        ...selectedMember,
                        role
                      });
                    }
                  }}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles && Array.isArray(roles) && roles
                      .filter((role: CommitteeRole) => {
                        // Non-admin users can't assign Chair or Co-Chair roles
                        if (!isAdmin && (role.name === 'Chair' || role.name === 'Co-Chair')) {
                          return false;
                        }
                        return true;
                      })
                      .map((role: CommitteeRole) => (
                        <SelectItem key={role.id} value={role.id.toString()}>
                          {role.name}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-end-date">End Date (Optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="edit-end-date"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {selectedMember.endDate ? (
                        format(new Date(selectedMember.endDate), "PPP")
                      ) : (
                        <span>No end date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={selectedMember.endDate ? new Date(selectedMember.endDate) : undefined}
                      onSelect={(date) => {
                        setSelectedMember({
                          ...selectedMember,
                          endDate: date ? date.toISOString() : null
                        });
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {selectedMember.endDate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedMember({
                        ...selectedMember,
                        endDate: null
                      });
                    }}
                  >
                    Clear End Date
                  </Button>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateMember}
              disabled={updateMemberMutation.isPending}
            >
              {updateMemberMutation.isPending ? "Updating..." : "Update Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={isRemoveMemberDialogOpen} onOpenChange={setIsRemoveMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Committee Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this member from the committee?
              This will set their end date to today.
            </DialogDescription>
          </DialogHeader>

          {selectedMember && (
            <div className="p-4 border rounded-md mb-4">
              <p><strong>Name:</strong> {formatMemberName(selectedMember.user)}</p>
              <p><strong>Email:</strong> {selectedMember.user.email}</p>
              <p><strong>Role:</strong> {selectedMember.role.name}</p>
              <p><strong>Start Date:</strong> {new Date(selectedMember.startDate).toLocaleDateString()}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRemoveMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chair Credentials Dialog */}
      {selectedMember && (
        <ChairCredentialsDialog
          isOpen={isCredentialsDialogOpen}
          onClose={() => {
            setIsCredentialsDialogOpen(false);
            setSelectedMember(null);
          }}
          memberId={selectedMember.user.id}
          memberName={formatMemberName(selectedMember.user)}
          committeeId={committeeId}
          role={selectedMember.role.name}
        />
      )}
    </Card>
  );
}