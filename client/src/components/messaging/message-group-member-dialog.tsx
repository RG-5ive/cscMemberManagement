import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageGroup } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "../ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";

interface MessageGroupMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
}

// Define a more flexible interface for handling both camelCase and snake_case fields
interface MemberData {
  id: number;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  email?: string;
  addedAt?: string; // Used for group members
  [key: string]: any; // To handle any additional fields
}

export function MessageGroupMemberDialog({ 
  open, 
  onOpenChange,
  groupId 
}: MessageGroupMemberDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  
  // Get group data
  const { data: group, isLoading: isLoadingGroup } = useQuery<MessageGroup>({
    queryKey: ['/api/message-groups', groupId],
    enabled: open && groupId > 0,
  });

  // Get current group members
  const { data: groupMembers, isLoading: isLoadingMembers } = useQuery<MemberData[]>({
    queryKey: ['/api/message-groups', groupId, 'members'],
    enabled: open && groupId > 0,
  });

  // Get all available members for adding to group
  const { data: allMembersResponse, isLoading: isLoadingAllMembers } = useQuery<{ members: MemberData[], pagination: any }>({
    queryKey: ['/api/members'],
    enabled: open && groupId > 0,
  });

  // Extract members from the response which now has a nested structure
  const allMembers = allMembersResponse?.members || [];
  
  // Get members not yet in the group
  const nonGroupMembers = Array.isArray(allMembers) ? 
    allMembers.filter(member => 
      !groupMembers?.some(groupMember => groupMember.id === member.id)
    ) : [];

  // Helper function to get a member's full name, handling both camelCase and snake_case
  const getMemberName = (member: MemberData): string => {
    const firstName = member.firstName || member.first_name || '';
    const lastName = member.lastName || member.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'Unknown';
  };

  // Filtered members based on search
  const filteredMembers = nonGroupMembers.filter(member => {
    if (!searchTerm) return true;
    
    const fullName = getMemberName(member).toLowerCase();
    const email = member.email?.toLowerCase() || '';
    
    return fullName.includes(searchTerm.toLowerCase()) || 
           email.includes(searchTerm.toLowerCase());
  });

  // Add member to group mutation
  const { mutate: addMember, isPending: isAddingMember } = useMutation({
    mutationFn: async (memberId: number) => {
      setSelectedMemberId(memberId);
      const res = await apiRequest("POST", `/api/message-groups/${groupId}/members`, { memberId });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Member added",
        description: "The member has been added to the group",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/message-groups', groupId, 'members'] });
      setSelectedMemberId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add member",
        description: error.message,
        variant: "destructive",
      });
      setSelectedMemberId(null);
    },
  });

  // Remove member from group mutation
  const { mutate: removeMember, isPending: isRemovingMember } = useMutation({
    mutationFn: async (memberId: number) => {
      setSelectedMemberId(memberId);
      const res = await apiRequest("DELETE", `/api/message-groups/${groupId}/members/${memberId}`);
      if (res.status === 204) {
        return null; // No content response is expected
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Member removed",
        description: "The member has been removed from the group",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/message-groups', groupId, 'members'] });
      setSelectedMemberId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove member",
        description: error.message,
        variant: "destructive",
      });
      setSelectedMemberId(null);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Manage Group Members</DialogTitle>
          <DialogDescription>
            {isLoadingGroup ? (
              <div>Loading group details...</div>
            ) : (
              group && `Add or remove members from the ${group.name} group`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Members Section */}
          <div>
            <h3 className="text-lg font-medium mb-2">Current Members</h3>
            {isLoadingMembers ? (
              <LoadingSpinner />
            ) : groupMembers && groupMembers.length > 0 ? (
              <div className="border rounded-md max-h-[200px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>{getMemberName(member)}</TableCell>
                        <TableCell>{member.email || 'No email'}</TableCell>
                        <TableCell>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => removeMember(member.id)}
                            disabled={isRemovingMember && selectedMemberId === member.id}
                          >
                            {isRemovingMember && selectedMemberId === member.id ? 
                              <LoadingSpinner size="sm" /> : "Remove"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground">No members in this group yet.</p>
            )}
          </div>

          {/* Add Members Section */}
          <div>
            <h3 className="text-lg font-medium mb-2">Add Members</h3>
            <Input
              placeholder="Search members by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
            />
            
            {isLoadingAllMembers ? (
              <LoadingSpinner />
            ) : filteredMembers.length > 0 ? (
              <div className="border rounded-md max-h-[200px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>{getMemberName(member)}</TableCell>
                        <TableCell>{member.email || 'No email'}</TableCell>
                        <TableCell>
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => addMember(member.id)}
                            disabled={isAddingMember && selectedMemberId === member.id}
                          >
                            {isAddingMember && selectedMemberId === member.id ? 
                              <LoadingSpinner size="sm" /> : "Add"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground">
                {searchTerm ? "No members found matching your search." : "All members are already in this group."}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}