import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff } from "lucide-react";

interface ChairCredentialsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: number | null;
  memberName: string;
  committeeId: number;
  role: string;
}

export function ChairCredentialsDialog({
  isOpen,
  onClose,
  memberId,
  memberName,
  committeeId,
  role
}: ChairCredentialsDialogProps) {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Convert UI role ("Chair", "Co-Chair") to system role ("committee_chair", "committee_cochair")
  const systemRole = role === "Chair" ? "committee_chair" : 
                   role === "Co-Chair" ? "committee_cochair" : 
                   "committee_member";
  
  // Only show for Chair or Co-Chair roles
  const isChairOrCoChair = role === "Chair" || role === "Co-Chair";
  
  if (!isChairOrCoChair) {
    return null;
  }

  const handleSetCredentials = async () => {
    if (!memberId || !username || !password) {
      toast({
        title: "Missing information",
        description: "Please provide both username and password",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const response = await apiRequest(
        "POST",
        `/api/committees/${committeeId}/members/${memberId}/credentials`,
        {
          username,
          password,
          role: systemRole
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Credentials set successfully",
          description: `Credentials for ${memberName} have been set`,
        });
        
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to set credentials");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to set credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set {role} Credentials</DialogTitle>
          <DialogDescription>
            Set login credentials for {memberName}. This will allow them to access the Committee {role} portal.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={toggleShowPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Note: Passwords are stored securely but are visible to administrators during setup.
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSetCredentials}
            disabled={isLoading || !username || !password}
          >
            {isLoading ? (
              <>
                <LoadingSpinner className="mr-2" />
                Setting Credentials...
              </>
            ) : (
              "Set Credentials"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}