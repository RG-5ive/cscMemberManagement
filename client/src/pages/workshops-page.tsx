import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Workshop } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, Clock, Users, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import CreateWorkshopDialog from "@/components/workshops/create-workshop-dialog";
import EditWorkshopDialog from "@/components/workshops/edit-workshop-dialog";
import { UserRegisteredWorkshops } from "@/components/workshops/user-registered-workshops";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkshopParticipantsManager } from "@/components/admin/workshop-participants-manager";

export default function WorkshopsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const [activeTab, setActiveTab] = useState("available");
  const [selectedWorkshop, setSelectedWorkshop] = useState<number | null>(null);
  const isAdmin = user?.role === "admin";

  // Fetch workshops
  const { data: workshops, isLoading, error, refetch } = useQuery<Workshop[]>({
    queryKey: ["/api/workshops"],
  });

  // This function is replaced by handleRegisterSuccess below

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-destructive mb-2">Error Loading Workshops</h2>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : "An unknown error occurred"}
        </p>
        <Button onClick={() => refetch()} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  // Function to handle successful registration
  const handleRegistrationSuccess = () => {
    // Invalidate both workshop queries to refresh data
    queryClient.invalidateQueries({ queryKey: ["/api/workshops"] });
    queryClient.invalidateQueries({ queryKey: ["/api/user/workshops"] });
    // Switch to the "your-workshops" tab
    setActiveTab("your-workshops");
  };

  // Handle successful workshop registration
  const handleRegisterSuccess = async (workshopId: number) => {
    try {
      const response = await apiRequest("POST", `/api/workshops/${workshopId}/register`, {});
      
      if (response.ok) {
        toast({
          title: "Registration Successful",
          description: "You have been registered for the workshop",
        });
        handleRegistrationSuccess();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to register for workshop");
      }
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Handle workshop edit
  const handleEditWorkshop = (workshop: Workshop) => {
    setEditingWorkshop(workshop);
    setOpenEditDialog(true);
  };

  // Handle successful workshop update
  const handleWorkshopUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/workshops"] });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Workshops & Events</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          {isAdmin && (
            <TabsTrigger value="create" onClick={() => setOpenCreateDialog(true)}>
              Create Workshop
            </TabsTrigger>
          )}
          <TabsTrigger value="available">Available Workshops</TabsTrigger>
          {!isAdmin && (
            <TabsTrigger value="your-workshops">Your Registrations</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="management">Workshop Management</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="available" className="mt-4">
          {workshops && workshops.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workshops.map((workshop) => (
                <WorkshopCard
                  key={workshop.id}
                  workshop={workshop}
                  onRegister={handleRegisterSuccess}
                  onEdit={handleEditWorkshop}
                  isAdmin={isAdmin}
                />
              ))}
            </div>
          ) : (
            <div className="text-center p-12 border rounded-lg bg-muted/20">
              <h3 className="text-xl font-medium mb-2">No Workshops Available</h3>
              <p className="text-muted-foreground">
                There are currently no scheduled workshops. Check back later for new opportunities.
              </p>
            </div>
          )}
        </TabsContent>
        
        {!isAdmin && (
          <TabsContent value="your-workshops" className="mt-4">
            <UserRegisteredWorkshops />
          </TabsContent>
        )}
        
        {isAdmin && (
          <TabsContent value="management" className="mt-4">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Workshop Management</h2>
              
              {!workshops || workshops.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                  <h3 className="text-xl font-medium mb-3">No Workshops Available</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    There are currently no workshops scheduled. Create a new workshop to get started.
                  </p>
                  <Button onClick={() => setOpenCreateDialog(true)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Create Workshop
                  </Button>
                </div>
              ) : (
                <>
                  {selectedWorkshop ? (
                    <WorkshopParticipantsManager
                      workshopId={selectedWorkshop}
                      workshop={workshops.find(w => w.id === selectedWorkshop)}
                      onBack={() => setSelectedWorkshop(null)}
                    />
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Workshop Name</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Capacity</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {workshops.map((workshop) => (
                            <TableRow key={workshop.id}>
                              <TableCell className="font-medium">{workshop.title}</TableCell>
                              <TableCell>{format(new Date(workshop.date), "MMM d, yyyy")}</TableCell>
                              <TableCell>{workshop.isOnline ? "Online" : workshop.locationAddress || "TBA"}</TableCell>
                              <TableCell>{workshop.capacity}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  new Date(workshop.date) > new Date() 
                                    ? "bg-green-100 text-green-800" 
                                    : "bg-gray-100 text-gray-800"
                                }`}>
                                  {new Date(workshop.date) > new Date() ? "Upcoming" : "Past"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditWorkshop(workshop)}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedWorkshop(workshop.id)}
                                  >
                                    <Users className="h-4 w-4 mr-1" />
                                    Participants
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {isAdmin && (
        <>
          <CreateWorkshopDialog
            open={openCreateDialog}
            onOpenChange={setOpenCreateDialog}
            onWorkshopCreated={() => {
              refetch();
              setOpenCreateDialog(false);
            }}
          />
          <EditWorkshopDialog
            workshop={editingWorkshop}
            open={openEditDialog}
            onOpenChange={setOpenEditDialog}
            onWorkshopUpdated={handleWorkshopUpdated}
          />
        </>
      )}
    </div>
  );
}

interface WorkshopCardProps {
  workshop: Workshop;
  onRegister: (workshopId: number) => Promise<void>;
  onEdit?: (workshop: Workshop) => void;
  isAdmin?: boolean;
}

function WorkshopCard({ workshop, onRegister, onEdit, isAdmin }: WorkshopCardProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const { data: committees = [] } = useQuery<any[]>({
    queryKey: ["/api/committees"],
  });

  const handleRegisterClick = async () => {
    setIsRegistering(true);
    try {
      await onRegister(workshop.id);
    } finally {
      setIsRegistering(false);
    }
  };

  const committee = committees.find(c => c.id === workshop.committeeId);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="line-clamp-2">{workshop.title}</CardTitle>
        <CardDescription>
          <div className="flex items-center mt-1">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>{format(new Date(workshop.date), "MMMM d, yyyy")}</span>
          </div>
          {workshop.startTime && workshop.endTime && (
            <div className="flex items-center mt-1">
              <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{workshop.startTime} - {workshop.endTime}</span>
            </div>
          )}
          {committee && (
            <div className="flex items-center mt-1">
              <Users className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-xs font-medium">{committee.name}</span>
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm">{workshop.description}</p>
        {workshop.locationAddress && (
          <div className="flex items-center mt-2">
            <span className="text-xs text-muted-foreground">📍 {workshop.locationAddress}</span>
          </div>
        )}
        {workshop.materials && (
          <div className="mt-2">
            <p className="text-xs font-medium text-muted-foreground">Materials Needed:</p>
            <p className="text-xs text-muted-foreground mt-1">{workshop.materials}</p>
          </div>
        )}
        <div className="flex items-center mt-3">
          <Users className="h-4 w-4 mr-2 text-muted-foreground" />
          <span className="text-sm">Capacity: {workshop.capacity} attendees</span>
        </div>
      </CardContent>
      <CardFooter>
        {isAdmin ? (
          <Button
            onClick={() => onEdit?.(workshop)}
            variant="outline"
            className="w-full"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Workshop
          </Button>
        ) : (
          <Button
            onClick={handleRegisterClick}
            disabled={isRegistering}
            className="w-full"
          >
            {isRegistering ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Registering...</span>
              </>
            ) : (
              "Register Now"
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}