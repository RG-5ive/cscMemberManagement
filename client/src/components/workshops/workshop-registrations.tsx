import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Workshop, WorkshopRegistration } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { ClipboardList, Trash } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";

export default function WorkshopRegistrations() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Fetch user's workshop registrations
  const { data: workshops, isLoading } = useQuery<Workshop[]>({
    queryKey: ["/api/user/workshops"],
    refetchOnWindowFocus: false,
  });

  // Fetch all available workshops
  const { data: allWorkshops } = useQuery<Workshop[]>({
    queryKey: ["/api/workshops"],
    refetchOnWindowFocus: false,
  });

  // Cancel registration mutation
  const cancelRegistrationMutation = useMutation({
    mutationFn: async (workshopId: number) => {
      const response = await apiRequest("DELETE", `/api/workshops/${workshopId}/register`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel registration");
      }
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Registration Cancelled",
        description: "You have been removed from the workshop",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/workshops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workshops"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle registration cancellation
  const handleCancelRegistration = async (workshopId: number) => {
    try {
      await cancelRegistrationMutation.mutateAsync(workshopId);
    } catch (error) {
      console.error("Failed to cancel registration:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If no registrations, show message and available workshops
  if (!workshops || workshops.length === 0) {
    return (
      <div>
        <div className="text-center py-8 border rounded-lg bg-muted/20 mb-8">
          <h3 className="text-xl font-semibold mb-2">No Workshop Registrations</h3>
          <p className="text-muted-foreground mb-4">
            You haven't registered for any workshops yet.
          </p>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/workshops'}
          >
            Browse Available Workshops
          </Button>
        </div>
        
        {allWorkshops && allWorkshops.length > 0 && (
          <>
            <h3 className="text-xl font-semibold mb-4">Available Workshops</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allWorkshops.slice(0, 4).map((workshop) => (
                <WorkshopCard 
                  key={workshop.id}
                  workshop={workshop}
                  registered={false}
                  onCancel={() => {}}
                />
              ))}
            </div>
            {allWorkshops.length > 4 && (
              <div className="text-center mt-4">
                <Button variant="link" onClick={() => window.location.href = '/workshops'}>
                  View All Workshops
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Your Workshop Registrations</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workshops.map((workshop) => (
          <WorkshopCard
            key={workshop.id}
            workshop={workshop}
            registered={true}
            onCancel={() => handleCancelRegistration(workshop.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface WorkshopCardProps {
  workshop: Workshop;
  registered: boolean;
  onCancel: () => void;
}

function WorkshopCard({ workshop, registered, onCancel }: WorkshopCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCancelClick = async () => {
    setIsLoading(true);
    try {
      await onCancel();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{workshop.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-sm">
            <span className="font-medium">Date:</span>{" "}
            {format(new Date(workshop.date), "MMMM d, yyyy")}
          </div>
          <div className="text-sm">
            <span className="font-medium">Time:</span>{" "}
            {format(new Date(workshop.date), "h:mm a")}
          </div>
          <div className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {workshop.description}
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center text-sm text-muted-foreground">
              <ClipboardList className="h-4 w-4 mr-1" />
              <span>Capacity: {workshop.capacity}</span>
            </div>
            
            {registered && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelClick}
                disabled={isLoading}
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <Trash className="h-4 w-4 mr-1" />
                    Cancel
                  </>
                )}
              </Button>
            )}
            
            {!registered && (
              <Button
                size="sm"
                onClick={() => window.location.href = '/workshops'}
              >
                Register
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}