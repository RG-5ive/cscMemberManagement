import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Workshop } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Check, Trash2, X } from 'lucide-react';

// Workshop participant interface
interface WorkshopParticipant {
  id: number;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  registeredAt: string;
  paymentStatus: string;
  isApproved: boolean;
}

interface WorkshopParticipantsManagerProps {
  workshopId: number;
  workshop: Workshop | undefined;
  onBack: () => void;
}

export function WorkshopParticipantsManager({ workshopId, workshop, onBack }: WorkshopParticipantsManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  
  // Fetch workshop registrations
  const { data: registrations, isLoading } = useQuery<WorkshopParticipant[]>({
    queryKey: [`/api/workshops/${workshopId}/registrations`],
    refetchOnWindowFocus: false,
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

  // Add participant mutation
  const addParticipantMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("POST", `/api/workshops/${workshopId}/add-participant`, { userId });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add participant");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Participant Added",
        description: "Successfully added participant to the workshop",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/workshops/${workshopId}/registrations`] });
      setSearchTerm('');
      setSelectedUserIds([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Participant",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Search all members (not just users with accounts)
  const { data: searchResults } = useQuery({
    queryKey: ['/api/members/search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];
      
      // First try to search using the comprehensive member search endpoint
      try {
        console.log(`Searching members with query: ${searchTerm}`);
        const response = await apiRequest("GET", `/api/members/search?query=${encodeURIComponent(searchTerm)}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log("Member search response:", data);
          
          // Process the data to get consistent format
          let members = data.members || data;
          return members;
        }
      } catch (error) {
        console.error("Error searching members:", error);
      }
      
      // If member search fails, fall back to user search
      try {
        const fallbackResponse = await apiRequest("GET", `/api/users/search?q=${encodeURIComponent(searchTerm)}`);
        if (!fallbackResponse.ok) {
          throw new Error("Failed to search users");
        }
        return fallbackResponse.json();
      } catch (error) {
        console.error("Error in fallback user search:", error);
        return [];
      }
    },
    enabled: searchTerm.length >= 2,
    refetchOnWindowFocus: false,
  });

  const handleRemoveParticipant = async (registrationId: number) => {
    if (confirm("Are you sure you want to remove this participant?")) {
      try {
        await removeParticipantMutation.mutateAsync(registrationId);
      } catch (error) {
        console.error("Failed to remove participant:", error);
      }
    }
  };

  const handleApprovePayment = async (registrationId: number) => {
    try {
      await approvePaymentMutation.mutateAsync(registrationId);
    } catch (error) {
      console.error("Failed to approve payment:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!workshop) {
    return (
      <div className="text-center py-6 border rounded-lg bg-muted/20">
        <h3 className="text-lg font-medium mb-2">Workshop Not Found</h3>
        <p className="text-muted-foreground mb-4">
          The requested workshop could not be found
        </p>
        <Button onClick={onBack} variant="outline">
          Back to Workshops
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mr-2"
        >
          &larr; Back to Workshops
        </Button>
        <h3 className="text-xl font-semibold">
          {workshop?.title} Participants
        </h3>
      </div>

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
              <p>{workshop.isOnline ? 'Online' : workshop.locationAddress}</p>
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

      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Add Participant</h4>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Search by name or email..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                  autoFocus={false}
                  onFocus={(e) => {
                    // Prevent auto-selection by immediately setting selection range to end
                    const value = e.target.value;
                    requestAnimationFrame(() => {
                      e.target.setSelectionRange(value.length, value.length);
                    });
                  }}
                />
                <Button 
                  variant="outline"
                  disabled={!searchTerm || searchTerm.length < 3}
                  onClick={() => setSearchTerm(searchTerm)} // Trigger search
                >
                  Search
                </Button>
              </div>
              
              {searchTerm.length >= 3 && (
                <div>
                  {!searchResults || searchResults.length === 0 ? (
                    <div className="text-center p-4 border rounded-lg bg-muted/20">
                      <p className="text-muted-foreground">No users found</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.map((result: any) => {
                            // Check if result is already registered
                            const isRegistered = registrations?.some(
                              (reg) => (reg as any).userId === result.id || 
                                     (result.user && (reg as any).userId === result.user.id)
                            );
                            
                            // Determine what type of result this is
                            const isMember = result.memberNumber !== undefined;
                            const hasUserAccount = result.role !== undefined || 
                                                 (result.user && result.user.id);
                            
                            return (
                              <TableRow key={result.id}>
                                <TableCell>{result.firstName} {result.lastName}</TableCell>
                                <TableCell>{result.email}</TableCell>
                                <TableCell>
                                  {isMember ? (
                                    <div className="flex gap-1 items-center">
                                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                        {result.category || "Member"}
                                      </span>
                                      {hasUserAccount && (
                                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">User</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">User</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isRegistered ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={true}
                                    >
                                      Already Registered
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        // If this is a member with a user account, use the user ID
                                        if (hasUserAccount) {
                                          const userId = result.id || (result.user && result.user.id);
                                          addParticipantMutation.mutate(userId);
                                        } else {
                                          // This is a member without a user account, use a different endpoint
                                          // Create a temporary request to add the member directly
                                          const addMemberToWorkshop = async () => {
                                            try {
                                              const response = await apiRequest(
                                                "POST", 
                                                `/api/workshops/${workshopId}/add-member`, 
                                                { memberId: result.id }
                                              );
                                              
                                              if (!response.ok) {
                                                const error = await response.json();
                                                throw new Error(error.error || "Failed to add member");
                                              }
                                              
                                              toast({
                                                title: "Member Added",
                                                description: "Successfully added member to the workshop",
                                              });
                                              
                                              // Reload the participants list
                                              queryClient.invalidateQueries({ 
                                                queryKey: [`/api/workshops/${workshopId}/registrations`] 
                                              });
                                            } catch (error) {
                                              console.error("Error adding member:", error);
                                              toast({
                                                title: "Failed to Add Member",
                                                description: error instanceof Error ? error.message : "Unknown error",
                                                variant: "destructive",
                                              });
                                            }
                                          };
                                          
                                          addMemberToWorkshop();
                                        }
                                      }}
                                      disabled={addParticipantMutation.isPending}
                                    >
                                      Add
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <h4 className="text-lg font-semibold mt-4">Current Participants</h4>

        {!registrations || registrations.length === 0 ? (
          <div className="text-center py-6 border rounded-lg bg-muted/20">
            <h3 className="text-lg font-medium mb-2">No Participants</h3>
            <p className="text-muted-foreground">
              There are currently no participants registered for this workshop
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
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
                {registrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">
                      {reg.user?.firstName} {reg.user?.lastName}
                    </TableCell>
                    <TableCell>{reg.user?.email}</TableCell>
                    <TableCell>
                      {format(new Date(reg.registeredAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {reg.paymentStatus === "paid" ? (
                        <span className="flex items-center text-green-600">
                          <Check className="h-4 w-4 mr-1" /> Paid
                        </span>
                      ) : reg.paymentStatus === "unpaid" ? (
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
                      {reg.paymentStatus === "unpaid" && (
                        <Button
                          variant="outline" 
                          size="sm"
                          onClick={() => handleApprovePayment(reg.id)}
                          className="text-green-600 border-green-200 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="h-4 w-4 mr-1" /> 
                          Confirm Payment
                        </Button>
                      )}
                      <Button
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRemoveParticipant(reg.id)}
                        className="text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> 
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkshopParticipantsManager;