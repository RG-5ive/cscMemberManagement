import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface CommitteeRole {
  id: number;
  name: string;
  description: string | null;
  canManageCommittee: boolean;
  canManageWorkshops: boolean;
  createdAt: string;
}

export function CommitteeRolesManager() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CommitteeRole | null>(null);
  const [newRole, setNewRole] = useState({
    name: "",
    description: "",
    canManageCommittee: false,
    canManageWorkshops: false
  });

  // Fetch committee roles
  const { data: roles, isLoading, error } = useQuery({
    queryKey: ["/api/committee-roles"],
    retry: 1
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (role: typeof newRole) => {
      const res = await apiRequest("POST", "/api/committee-roles", role);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create role");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/committee-roles"] });
      setIsCreateDialogOpen(false);
      setNewRole({
        name: "",
        description: "",
        canManageCommittee: false,
        canManageWorkshops: false
      });
      toast({
        title: "Role created",
        description: "The committee role has been created successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create role",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async (role: CommitteeRole) => {
      const res = await apiRequest("PUT", `/api/committee-roles/${role.id}`, {
        name: role.name,
        description: role.description,
        canManageCommittee: role.canManageCommittee,
        canManageWorkshops: role.canManageWorkshops
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update role");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/committee-roles"] });
      setIsEditDialogOpen(false);
      setSelectedRole(null);
      toast({
        title: "Role updated",
        description: "The committee role has been updated successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: number) => {
      const res = await apiRequest("DELETE", `/api/committee-roles/${roleId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete role");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/committee-roles"] });
      setIsDeleteDialogOpen(false);
      setSelectedRole(null);
      toast({
        title: "Role deleted",
        description: "The committee role has been deleted successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete role",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle open edit dialog
  const handleEditRole = (role: CommitteeRole) => {
    setSelectedRole(role);
    setIsEditDialogOpen(true);
  };

  // Handle open delete dialog
  const handleDeleteRole = (role: CommitteeRole) => {
    setSelectedRole(role);
    setIsDeleteDialogOpen(true);
  };

  // Create role handler
  const handleCreateRole = () => {
    createRoleMutation.mutate(newRole);
  };

  // Update role handler
  const handleUpdateRole = () => {
    if (selectedRole) {
      updateRoleMutation.mutate(selectedRole);
    }
  };

  // Delete role handler
  const handleConfirmDelete = () => {
    if (selectedRole) {
      deleteRoleMutation.mutate(selectedRole.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4">
        Error loading committee roles: {(error as Error).message}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Committee Roles</CardTitle>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </CardHeader>
      <CardContent>
        {roles && Array.isArray(roles) && roles.length > 0 ? (
          <div className="grid gap-4">
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-left font-medium">Name</th>
                    <th className="p-3 text-left font-medium">Description</th>
                    <th className="p-3 text-center font-medium">Manage Committee</th>
                    <th className="p-3 text-center font-medium">Manage Workshops</th>
                    <th className="p-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(roles) && roles.map((role: CommitteeRole) => (
                    <tr key={role.id} className="border-b">
                      <td className="p-3">{role.name}</td>
                      <td className="p-3">{role.description || "-"}</td>
                      <td className="p-3 text-center">
                        {role.canManageCommittee ? "Yes" : "No"}
                      </td>
                      <td className="p-3 text-center">
                        {role.canManageWorkshops ? "Yes" : "No"}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditRole(role)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDeleteRole(role)}
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
            No committee roles defined. Create a role to get started.
          </div>
        )}
      </CardContent>

      {/* Create Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Committee Role</DialogTitle>
            <DialogDescription>
              Add a new role for committee members
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                placeholder="e.g., Chair, Co-Chair, Member"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                placeholder="Role description and permissions"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="manage-committee"
                checked={newRole.canManageCommittee}
                onCheckedChange={(checked) =>
                  setNewRole({ ...newRole, canManageCommittee: checked as boolean })
                }
              />
              <Label htmlFor="manage-committee">Can manage committee</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="manage-workshops"
                checked={newRole.canManageWorkshops}
                onCheckedChange={(checked) =>
                  setNewRole({ ...newRole, canManageWorkshops: checked as boolean })
                }
              />
              <Label htmlFor="manage-workshops">Can manage workshops</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateRole}
              disabled={!newRole.name || createRoleMutation.isPending}
            >
              {createRoleMutation.isPending ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Committee Role</DialogTitle>
            <DialogDescription>
              Update the role details and permissions
            </DialogDescription>
          </DialogHeader>

          {selectedRole && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Role Name</Label>
                <Input
                  id="edit-name"
                  value={selectedRole.name}
                  onChange={(e) => setSelectedRole({ ...selectedRole, name: e.target.value })}
                  placeholder="e.g., Chair, Co-Chair, Member"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={selectedRole.description || ""}
                  onChange={(e) => setSelectedRole({ ...selectedRole, description: e.target.value })}
                  placeholder="Role description and permissions"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-manage-committee"
                  checked={selectedRole.canManageCommittee}
                  onCheckedChange={(checked) =>
                    setSelectedRole({ ...selectedRole, canManageCommittee: checked as boolean })
                  }
                />
                <Label htmlFor="edit-manage-committee">Can manage committee</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-manage-workshops"
                  checked={selectedRole.canManageWorkshops}
                  onCheckedChange={(checked) =>
                    setSelectedRole({ ...selectedRole, canManageWorkshops: checked as boolean })
                  }
                />
                <Label htmlFor="edit-manage-workshops">Can manage workshops</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={!selectedRole?.name || updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Committee Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this role? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedRole && (
            <div className="p-4 border rounded-md mb-4">
              <p><strong>Name:</strong> {selectedRole.name}</p>
              <p><strong>Description:</strong> {selectedRole.description || "-"}</p>
              <p><strong>Can manage committee:</strong> {selectedRole.canManageCommittee ? "Yes" : "No"}</p>
              <p><strong>Can manage workshops:</strong> {selectedRole.canManageWorkshops ? "Yes" : "No"}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteRoleMutation.isPending}
            >
              {deleteRoleMutation.isPending ? "Deleting..." : "Delete Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}