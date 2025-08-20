import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface User {
  id: number;
  username: string;
  email: string;
  memberLevel?: string;
  role: "user" | "admin";
  firstName?: string;
  lastName?: string;
  location?: string;
  createdAt?: string;
}

interface UserTableProps {
  showOnlyAdmins?: boolean;
}

export function UserTable({ showOnlyAdmins = false }: UserTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: "user" | "admin" }) => {
      await apiRequest("PATCH", `/api/user/${userId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Role Updated",
        description: "User role has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users
    .filter((user) => showOnlyAdmins ? user.role === "admin" : true)
    .filter((user) =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input
          placeholder={showOnlyAdmins ? "Search admin users..." : "Search users..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        {showOnlyAdmins && (
          <div className="text-sm text-muted-foreground font-medium">
            Showing {filteredUsers.length} admin user{filteredUsers.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Member Level</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Created</TableHead>
            {!showOnlyAdmins && <TableHead className="w-[100px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.firstName || user.lastName ? 
                  `${user.firstName || ''} ${user.lastName || ''}`.trim() : 
                  'Not provided'
                }
              </TableCell>
              <TableCell>{user.username}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell>{user.memberLevel || "Not set"}</TableCell>
              <TableCell>{user.location || "Not set"}</TableCell>
              <TableCell className="text-sm text-muted-foreground font-medium">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
              </TableCell>
              {!showOnlyAdmins && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        {updateRoleMutation.isPending ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          updateRoleMutation.mutate({
                            userId: user.id,
                            role: user.role === "admin" ? "user" : "admin"
                          })
                        }
                        disabled={updateRoleMutation.isPending}
                      >
                        Make {user.role === "admin" ? "User" : "Admin"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}