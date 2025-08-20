import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Workshop } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, Clock, Users, X } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export function UserRegisteredWorkshops() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's registered workshops
  const { data: workshops, isLoading, error } = useQuery<any[]>({
    queryKey: ["/api/user/workshops"],
  });

  // Cancel registration mutation
  const cancelRegistrationMutation = useMutation({
    mutationFn: async (workshopId: number) => {
      const response = await apiRequest("DELETE", `/api/workshops/${workshopId}/register`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel registration");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Registration Cancelled",
        description: "Your workshop registration has been cancelled.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/workshops"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workshops"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-bold text-destructive mb-2">Error Loading Your Registrations</h2>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : "An unknown error occurred"}
        </p>
      </div>
    );
  }

  if (!workshops || workshops.length === 0) {
    return (
      <div className="text-center p-6 border rounded-lg bg-muted/20">
        <h3 className="text-lg font-medium mb-2">No Registered Workshops</h3>
        <p className="text-muted-foreground">
          You haven't registered for any workshops yet. Check the available workshops and register for those that interest you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Your Registered Workshops</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workshops.map((workshop) => (
          <RegisteredWorkshopCard
            key={workshop.id}
            workshop={workshop}
            onCancel={() => cancelRegistrationMutation.mutate(workshop.id)}
            isCancelling={cancelRegistrationMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}

interface RegisteredWorkshopCardProps {
  workshop: any;
  onCancel: () => void;
  isCancelling: boolean;
}

function RegisteredWorkshopCard({ workshop, onCancel, isCancelling }: RegisteredWorkshopCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleCancelClick = () => {
    if (isConfirming) {
      onCancel();
      setIsConfirming(false);
    } else {
      setIsConfirming(true);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-1">{workshop.title}</CardTitle>
        <CardDescription>
          <div className="flex items-center mt-1">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>{format(new Date(workshop.date), "MMMM d, yyyy")}</span>
          </div>
          <div className="flex items-center mt-1">
            <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>{format(new Date(workshop.date), "h:mm a")}</span>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-sm line-clamp-2">{workshop.description}</p>
      </CardContent>
      <CardFooter>
        <Button
          variant={isConfirming ? "destructive" : "outline"}
          size="sm"
          className="w-full"
          onClick={handleCancelClick}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="ml-2">Cancelling...</span>
            </>
          ) : isConfirming ? (
            <>
              <X className="h-4 w-4 mr-1" />
              Confirm Cancellation
            </>
          ) : (
            "Cancel Registration"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}