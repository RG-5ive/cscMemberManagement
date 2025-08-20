import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PrivacyNoticeProps {
  accessLevel: 'full' | 'limited';
  context?: 'members' | 'search' | 'dashboard';
}

export function PrivacyNotice({ accessLevel, context = 'members' }: PrivacyNoticeProps) {
  if (accessLevel === 'full') {
    return (
      <Alert className="mb-4 border-green-200 bg-green-50">
        <Eye className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <div className="flex items-center justify-between">
            <span>
              You have full access to demographic data as a Diversity Committee chair.
            </span>
            <Badge variant="outline" className="text-green-700 border-green-300">
              Full Access
            </Badge>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50">
      <Shield className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800">
        <div className="flex items-center justify-between">
          <div>
            <span>
              Demographic data is restricted for privacy compliance. 
            </span>
            <span className="block text-sm mt-1">
              Contact Diversity Committee chairs for demographic insights.
            </span>
          </div>
          <Badge variant="outline" className="text-blue-700 border-blue-300">
            <EyeOff className="h-3 w-3 mr-1" />
            Limited Access
          </Badge>
        </div>
      </AlertDescription>
    </Alert>
  );
}