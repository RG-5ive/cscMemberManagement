import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CommitteeRolesManager } from "@/components/admin/committee-roles-manager";
import { CommitteeMembersManager } from "@/components/admin/committee-members-manager";
import { Redirect } from "wouter";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, UserPlus, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Committee {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface CommitteeRole {
  id: number;
  name: string;
  description: string | null;
}

interface MemberAssignment {
  userId: number;
  roleId: number;
  userName?: string;
  roleName?: string;
}

export default function CommitteeManagementPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newCommittee, setNewCommittee] = useState({
    name: "",
    description: "",
  });
  const [memberAssignments, setMemberAssignments] = useState<
    MemberAssignment[]
  >([]);
  const [editCommittee, setEditCommittee] = useState<Committee | null>(null);
  const [committeeToDelete, setCommitteeToDelete] = useState<Committee | null>(
    null
  );
  const [selectedCommitteeId, setSelectedCommitteeId] = useState<number | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<string>("committees");

  // Fetch committees
  const {
    data: committees,
    isLoading,
    error,
  } = useQuery<any>({
    queryKey: ["/api/committees"],
  });

  // Fetch users for member assignment
  const { data: users } = useQuery<any>({
    queryKey: ["/api/users"],
    enabled: isCreateDialogOpen,
  });

  // Fetch committee roles for role assignment
  const { data: committeeRoles } = useQuery<any>({
    queryKey: ["/api/committee-roles"],
    enabled: isCreateDialogOpen,
  });

  // Create committee mutation
  const createCommitteeMutation = useMutation({
    mutationFn: async (
      committeeData: typeof newCommittee & { members?: MemberAssignment[] }
    ) => {
      const res = await apiRequest("POST", "/api/committees", committeeData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create committee");
      }
      return await res.json();
    },
    onSuccess: (committee) => {
      queryClient.invalidateQueries({ queryKey: ["/api/committees"] });
      setIsCreateDialogOpen(false);
      setNewCommittee({ name: "", description: "" });
      setMemberAssignments([]);
      setSelectedCommitteeId(committee.id);
      setActiveTab("members");
      toast({
        title: "Committee created",
        description: `Committee created successfully${
          committee.addedMembers
            ? ` with ${committee.addedMembers} member(s)`
            : ""
        }.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create committee",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update committee mutation
  const updateCommitteeMutation = useMutation({
    mutationFn: async (committee: Committee) => {
      const res = await apiRequest("PUT", `/api/committees/${committee.id}`, {
        name: committee.name,
        description: committee.description,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update committee");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/committees"] });
      setIsEditDialogOpen(false);
      setEditCommittee(null);
      toast({
        title: "Committee updated",
        description: "The committee has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update committee",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete committee mutation
  const deleteCommitteeMutation = useMutation({
    mutationFn: async (committeeId: number) => {
      const res = await apiRequest("DELETE", `/api/committees/${committeeId}`);
      if (!res.ok) {
        try {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to delete committee");
        } catch (e) {
          throw new Error("Failed to delete committee");
        }
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/committees"] });
      setIsDeleteDialogOpen(false);
      setCommitteeToDelete(null);
      if (selectedCommitteeId === committeeToDelete?.id) {
        setSelectedCommitteeId(null);
        setActiveTab("committees");
      }
      toast({
        title: "Committee deleted",
        description: "The committee has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete committee",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add member assignment
  const addMemberAssignment = () => {
    setMemberAssignments([...memberAssignments, { userId: 0, roleId: 0 }]);
  };

  // Remove member assignment
  const removeMemberAssignment = (index: number) => {
    setMemberAssignments(memberAssignments.filter((_, i) => i !== index));
  };

  // Update member assignment
  const updateMemberAssignment = (
    index: number,
    field: "userId" | "roleId",
    value: number
  ) => {
    const updated = [...memberAssignments];
    updated[index][field] = value;

    // Update display names for better UX
    if (field === "userId" && users) {
      const user = Array.isArray(users)
        ? users.find((u: User) => u.id === value)
        : null;
      if (user) {
        updated[index].userName = user.username;
      }
    }
    if (field === "roleId" && committeeRoles) {
      const role = Array.isArray(committeeRoles)
        ? committeeRoles.find((r: CommitteeRole) => r.id === value)
        : null;
      if (role) {
        updated[index].roleName = role.name;
      }
    }

    setMemberAssignments(updated);
  };

  // Handle create committee
  const handleCreateCommittee = () => {
    if (!newCommittee.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a name for the committee.",
        variant: "destructive",
      });
      return;
    }

    const validAssignments = memberAssignments.filter(
      (assignment) => assignment.userId > 0 && assignment.roleId > 0
    );

    const committeeData = {
      ...newCommittee,
      members: validAssignments.length > 0 ? validAssignments : undefined,
    };

    createCommitteeMutation.mutate(committeeData);
  };

  // Handle edit committee
  const handleUpdateCommittee = () => {
    if (!editCommittee || !editCommittee.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a name for the committee.",
        variant: "destructive",
      });
      return;
    }

    updateCommitteeMutation.mutate(editCommittee);
  };

  // Handle delete committee
  const handleDeleteCommittee = () => {
    if (!committeeToDelete) return;
    deleteCommitteeMutation.mutate(committeeToDelete.id);
  };

  // Open edit dialog
  const openEditDialog = (committee: Committee) => {
    setEditCommittee(committee);
    setIsEditDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (committee: Committee) => {
    setCommitteeToDelete(committee);
    setIsDeleteDialogOpen(true);
  };

  // Select a committee
  const handleSelectCommittee = (committeeId: number) => {
    setSelectedCommitteeId(committeeId);
    setActiveTab("members");
  };

  if (isAuthLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // Check if user is admin
  if (
    user?.role !== "admin" &&
    user?.role !== "committee_chair" &&
    !user?.canManageCommittees
  ) {
    return <Redirect to="/" />;
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Committee Management</h1>
        {isAdmin && (
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Committee
          </Button>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="committees">Committees</TabsTrigger>
          {selectedCommitteeId && (
            <TabsTrigger value="members">Committee Members</TabsTrigger>
          )}
          {isAdmin && <TabsTrigger value="roles">Committee Roles</TabsTrigger>}
        </TabsList>

        <TabsContent value="committees" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="text-destructive p-4">
              Error loading committees: {(error as Error).message}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {committees &&
                Array.isArray(committees) &&
                committees.map((committee: Committee) => {
                  return (
                    <Card
                      key={committee.id}
                      className="hover:bg-accent/5 transition-colors"
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{committee.name}</CardTitle>
                            {committee.description && (
                              <CardDescription>
                                {committee.description}
                              </CardDescription>
                            )}
                          </div>
                          {isAdmin && (
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(committee)}
                                title="Edit Committee"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(committee)}
                                title="Delete Committee"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button
                          onClick={() => handleSelectCommittee(committee.id)}
                          variant="outline"
                          className="w-full"
                        >
                          Manage Members
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}

              {(!committees ||
                !Array.isArray(committees) ||
                committees.length === 0) && (
                <div className="col-span-2 text-center p-8 border rounded-md">
                  <p className="text-muted-foreground mb-4">
                    No committees found.
                  </p>
                  {isAdmin && (
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Committee
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members">
          {selectedCommitteeId ? (
            <CommitteeMembersManager
              committeeId={selectedCommitteeId}
              committeeName={
                committees && Array.isArray(committees)
                  ? committees.find(
                      (c: Committee) => c.id === selectedCommitteeId
                    )?.name
                  : undefined
              }
            />
          ) : (
            <div className="text-center p-8 border rounded-md">
              <p className="text-muted-foreground">
                Please select a committee first.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="roles">
          {isAdmin && <CommitteeRolesManager />}
        </TabsContent>
      </Tabs>

      {/* Create Committee Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Committee</DialogTitle>
            <DialogDescription>
              Add a new committee to the system
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Committee Name</Label>
              <Input
                id="name"
                value={newCommittee.name}
                onChange={(e) =>
                  setNewCommittee({ ...newCommittee, name: e.target.value })
                }
                placeholder="e.g., Education Committee"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={newCommittee.description}
                onChange={(e) =>
                  setNewCommittee({
                    ...newCommittee,
                    description: e.target.value,
                  })
                }
                placeholder="Describe the committee's purpose and responsibilities"
              />
            </div>

            {/* Member Assignment Section */}
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">
                  Committee Members (Optional)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMemberAssignment}
                  data-testid="button-add-member"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </div>

              {memberAssignments.length > 0 && (
                <div className="space-y-3">
                  {memberAssignments.map((assignment, index) => (
                    <Card key={index} className="p-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                        <div className="grid gap-2">
                          <Label htmlFor={`user-${index}`}>Member</Label>
                          <Select
                            value={assignment.userId.toString()}
                            onValueChange={(value) =>
                              updateMemberAssignment(
                                index,
                                "userId",
                                parseInt(value)
                              )
                            }
                          >
                            <SelectTrigger data-testid={`select-user-${index}`}>
                              <SelectValue placeholder="Select a member" />
                            </SelectTrigger>
                            <SelectContent>
                              {users &&
                                Array.isArray(users) &&
                                users.map((user: User) => (
                                  <SelectItem
                                    key={user.id}
                                    value={user.id.toString()}
                                  >
                                    {user.username} ({user.email})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor={`role-${index}`}>Role</Label>
                          <Select
                            value={assignment.roleId.toString()}
                            onValueChange={(value) =>
                              updateMemberAssignment(
                                index,
                                "roleId",
                                parseInt(value)
                              )
                            }
                          >
                            <SelectTrigger data-testid={`select-role-${index}`}>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                              {committeeRoles &&
                                Array.isArray(committeeRoles) &&
                                committeeRoles.map((role: CommitteeRole) => (
                                  <SelectItem
                                    key={role.id}
                                    value={role.id.toString()}
                                  >
                                    {role.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeMemberAssignment(index)}
                            data-testid={`button-remove-member-${index}`}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {memberAssignments.length === 0 && (
                <div className="text-center p-4 border rounded-md bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    No members assigned yet. Click "Add Member" to assign
                    members to this committee.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCommittee}
              disabled={
                !newCommittee.name.trim() || createCommitteeMutation.isPending
              }
            >
              {createCommitteeMutation.isPending
                ? "Creating..."
                : "Create Committee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Committee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Committee</DialogTitle>
            <DialogDescription>Update committee details</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Committee Name</Label>
              <Input
                id="edit-name"
                value={editCommittee?.name || ""}
                onChange={(e) =>
                  setEditCommittee(
                    editCommittee
                      ? { ...editCommittee, name: e.target.value }
                      : null
                  )
                }
                placeholder="e.g., Education Committee"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={editCommittee?.description || ""}
                onChange={(e) =>
                  setEditCommittee(
                    editCommittee
                      ? { ...editCommittee, description: e.target.value }
                      : null
                  )
                }
                placeholder="Describe the committee's purpose and responsibilities"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateCommittee}
              disabled={
                !editCommittee?.name.trim() || updateCommitteeMutation.isPending
              }
            >
              {updateCommitteeMutation.isPending
                ? "Updating..."
                : "Update Committee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Committee Confirmation */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              committee
              {committeeToDelete?.name && (
                <strong> "{committeeToDelete.name}"</strong>
              )}{" "}
              and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCommittee}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCommitteeMutation.isPending}
            >
              {deleteCommitteeMutation.isPending
                ? "Deleting..."
                : "Delete Committee"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
