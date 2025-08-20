import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getQueryFn, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { MessageGroupDialog } from "./message-group-dialog";
import { MessageGroupMemberDialog } from "./message-group-member-dialog";
import { MessageGroupSendDialog } from "./message-group-send-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PlusIcon, UsersIcon, Trash2Icon, Edit2Icon, SendIcon } from "lucide-react";
import { MessageGroup } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function MessageGroupList() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [sendMessageDialogOpen, setSendMessageDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch message groups
  const { data: groups = [], isLoading, error } = useQuery<MessageGroup[]>({
    queryKey: ["/api/message-groups"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Delete message group mutation
  const deleteMutation = useMutation({
    mutationFn: async (groupId: number) => {
      await apiRequest("DELETE", `/api/message-groups/${groupId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Message group deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete message group",
        variant: "destructive",
      });
    },
  });

  const handleDeleteGroup = (groupId: number) => {
    setSelectedGroupId(groupId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedGroupId) {
      deleteMutation.mutate(selectedGroupId);
    }
  };

  const handleManageMembers = (groupId: number) => {
    setSelectedGroupId(groupId);
    setMembersDialogOpen(true);
  };

  const handleSendMessage = (groupId: number) => {
    setSelectedGroupId(groupId);
    setSendMessageDialogOpen(true);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500">Error loading message groups: {error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Message Groups</h2>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      {groups && groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group: any) => (
            <Card key={group.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle>{group.name}</CardTitle>
                {group.description && <CardDescription>{group.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Created: {new Date(group.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
              <CardFooter className="bg-muted/50 pt-3 flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleManageMembers(group.id)}
                >
                  <UsersIcon className="h-4 w-4 mr-1" />
                  Members
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleSendMessage(group.id)}
                >
                  <SendIcon className="h-4 w-4 mr-1" />
                  Send
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-100"
                  onClick={() => handleDeleteGroup(group.id)}
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border rounded-lg bg-muted/50">
          <p className="text-muted-foreground">No message groups created yet</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setCreateDialogOpen(true)}
          >
            Create your first message group
          </Button>
        </div>
      )}

      {/* Create Group Dialog */}
      <MessageGroupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Manage Members Dialog */}
      {selectedGroupId && (
        <MessageGroupMemberDialog
          open={membersDialogOpen}
          onOpenChange={setMembersDialogOpen}
          groupId={selectedGroupId}
        />
      )}

      {/* Send Message Dialog */}
      {selectedGroupId && (
        <MessageGroupSendDialog
          open={sendMessageDialogOpen}
          onOpenChange={setSendMessageDialogOpen}
          groupId={selectedGroupId}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the message group and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}