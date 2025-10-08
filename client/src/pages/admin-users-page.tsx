import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserTable } from "@/components/admin/user-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateAdminUserDialog } from "@/components/admin/create-admin-user-dialog";

export default function AdminUsersPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Admin Users Management</CardTitle>
              <CardDescription>
                Manage administrative users and their access permissions. View admin profiles, contact information, and role assignments.
              </CardDescription>
            </div>
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="flex items-center gap-2"
              data-testid="button-create-admin-user"
            >
              <Plus className="h-4 w-4" />
              Create Admin User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <UserTable showOnlyAdmins={true} />
        </CardContent>
      </Card>

      <CreateAdminUserDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}