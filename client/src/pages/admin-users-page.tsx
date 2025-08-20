import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserTable } from "@/components/admin/user-table";

export default function AdminUsersPage() {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Users Management</CardTitle>
          <CardDescription>
            Manage administrative users and their access permissions. View admin profiles, contact information, and role assignments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserTable showOnlyAdmins={true} />
        </CardContent>
      </Card>
    </div>
  );
}