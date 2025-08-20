import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Workshop } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Trash2, Check, X, Mail } from "lucide-react";
import { format } from "date-fns";
import AddWorkshopParticipantDialog from "./add-workshop-participant-dialog";

interface AdminWorkshopParticipantsProps {
  workshopId: number;
}

export default function AdminWorkshopParticipants({ workshopId }: AdminWorkshopParticipantsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openAddDialog, setOpenAddDialog] = useState(false);
  
  // Fetch workshop registrations
  const { data: registrations, isLoading: registrationsLoading } = useQuery<any[]>({
    queryKey: [`/api/workshops/${workshopId}/registrations`],
    refetchOnWindowFocus: false,
  });

  // Fetch workshop details
  const { data: workshop, isLoading: workshopLoading } = useQuery<Workshop>({
    queryKey: [`/api/workshops/${workshopId}`],
    refetchOnWindowFocus: false,
  });

  // Approve payment mutation
  const approvePaymentMutation = useMutation({
    mutationFn: async (registrationId: number) => {
      const response = await apiRequest("POST", `/api/workshops/registration/${registrationId}/approve-payment`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve payment");
      }
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Payment Approved",
        description: "Registration payment has been approved",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/workshops/${workshopId}/registrations`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Approve Payment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove participant mutation
  const removeParticipantMutation = useMutation({
    mutationFn: async (registrationId: number) => {
      const response = await apiRequest("DELETE", `/api/workshops/registration/${registrationId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove participant");
      }
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Participant Removed",
        description: "Participant has been removed from the workshop",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/workshops/${workshopId}/registrations`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Remove Participant",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApprovePayment = async (registrationId: number) => {
    try {
      await approvePaymentMutation.mutateAsync(registrationId);
    } catch (error) {
      console.error("Failed to approve payment:", error);
    }
  };

  const handleRemoveParticipant = async (registrationId: number) => {
    try {
      await removeParticipantMutation.mutateAsync(registrationId);
    } catch (error) {
      console.error("Failed to remove participant:", error);
    }
  };

  const isLoading = registrationsLoading || workshopLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!workshop) {
    return (
      <div className="text-center p-6 border rounded-lg bg-muted/20">
        <h3 className="text-lg font-medium mb-2">Workshop Not Found</h3>
        <p className="text-muted-foreground">
          The requested workshop could not be found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workshop Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Date:</span>
              <p>{format(new Date(workshop.date), "MMMM d, yyyy 'at' h:mm a")}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Location:</span>
              <p>{workshop.isOnline ? 'Online' : (workshop.locationAddress || 'Location not specified')}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Capacity:</span>
              <p>{workshop.capacity} participants</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Current Registrations:</span>
              <p>{registrations?.length || 0} participants</p>
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">Description:</span>
            <p className="mt-1">{workshop.description}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Registered Participants</h3>
        <Button 
          onClick={() => setOpenAddDialog(true)}
          disabled={(registrations || []).length >= workshop.capacity}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add Participant
        </Button>
      </div>
      
      {!registrations || registrations.length === 0 ? (
        <div className="text-center p-6 border rounded-lg bg-muted/20">
          <h3 className="text-lg font-medium mb-2">No Participants</h3>
          <p className="text-muted-foreground mb-4">
            There are currently no participants registered for this workshop
          </p>
          <Button onClick={() => setOpenAddDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Participant
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Registration Date</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((registration: any) => (
                <TableRow key={registration.id}>
                  <TableCell className="font-medium">
                    {registration.user?.firstName} {registration.user?.lastName}
                  </TableCell>
                  <TableCell>{registration.user?.email}</TableCell>
                  <TableCell>
                    {format(new Date(registration.registeredAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {registration.paymentConfirmed ? (
                      <span className="flex items-center text-green-600">
                        <Check className="h-4 w-4 mr-1" /> Paid
                      </span>
                    ) : workshop.isPaid ? (
                      <span className="flex items-center text-amber-600">
                        <X className="h-4 w-4 mr-1" /> Pending
                      </span>
                    ) : (
                      <span className="flex items-center text-blue-600">
                        <Check className="h-4 w-4 mr-1" /> N/A (Free)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {workshop.isPaid && !registration.paymentConfirmed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApprovePayment(registration.id)}
                        className="text-green-600 border-green-200 hover:text-green-700 hover:bg-green-50"
                      >
                        <Check className="h-4 w-4 mr-1" /> Confirm Payment
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveParticipant(registration.id)}
                      className="text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddWorkshopParticipantDialog
        open={openAddDialog}
        onOpenChange={setOpenAddDialog}
        workshopId={workshopId}
        onParticipantAdded={() => {
          queryClient.invalidateQueries({ queryKey: [`/api/workshops/${workshopId}/registrations`] });
          setOpenAddDialog(false);
        }}
        remainingCapacity={workshop.capacity - (registrations?.length || 0)}
      />
    </div>
  );
}