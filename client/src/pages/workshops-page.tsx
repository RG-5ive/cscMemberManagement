import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Workshop } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { Calendar, Clock, Users, Edit, Trash2, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import CreateWorkshopDialog from "@/components/workshops/create-workshop-dialog";
import EditWorkshopDialog from "@/components/workshops/edit-workshop-dialog";
import { UserRegisteredWorkshops } from "@/components/workshops/user-registered-workshops";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WorkshopParticipantsManager } from "@/components/admin/workshop-participants-manager";
import { Link } from "wouter";
import { PaymentCheckoutDialog } from "@/components/payments/payment-checkout-dialog";

export default function WorkshopsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const [activeTab, setActiveTab] = useState("available");
  const [selectedWorkshop, setSelectedWorkshop] = useState<number | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{ workshopId: number; workshopTitle: string; registrationId: number } | null>(null);
  const isAdmin = user?.role === "admin";

  // Fetch workshops
  const { data: workshops, isLoading, error, refetch } = useQuery<Workshop[]>({
    queryKey: ["/api/workshops"],
  });

  // Fetch committees for displaying committee names
  const { data: committees = [] } = useQuery<any[]>({
    queryKey: ["/api/committees"],
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
      // Find the workshop to check if it's paid
      const workshop = workshops?.find(w => w.id === workshopId);
      
      if (!workshop) {
        throw new Error("Workshop not found");
      }

      // Create the registration
      const response = await apiRequest("POST", `/api/workshops/${workshopId}/register`, {});
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to register for workshop");
      }

      const registration = await response.json();

      // Check if workshop requires payment
      if (workshop.isPaid && workshop.baseCost && workshop.baseCost > 0) {
        // Show payment dialog
        setPendingPayment({
          workshopId: workshop.id,
          workshopTitle: workshop.title,
          registrationId: registration.id,
        });
        setPaymentDialogOpen(true);
      } else {
        // Free workshop - registration complete
        toast({
          title: "Registration Successful",
          description: "You have been registered for the workshop",
        });
        handleRegistrationSuccess();
      }
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Handle payment success
  const handlePaymentSuccess = () => {
    toast({
      title: "Payment Complete",
      description: "Your workshop registration is confirmed!",
    });
    handleRegistrationSuccess();
    setPendingPayment(null);
  };

  // Handle workshop edit
  const handleEditWorkshop = (workshop: Workshop) => {
    setEditingWorkshop(workshop);
    setOpenEditDialog(true);
  };

  // Handle workshop visibility update
  const handleUpdateVisibility = async (workshopId: number, visibility: { visibleToGeneralMembers?: boolean; visibleToCommitteeChairs?: boolean; visibleToAdmins?: boolean }) => {
    try {
      const response = await apiRequest("PATCH", `/api/workshops/${workshopId}/visibility`, visibility);
      
      if (response.ok) {
        toast({
          title: "Visibility Updated",
          description: "Workshop calendar visibility has been updated",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/workshops"] });
      } else {
        throw new Error("Failed to update visibility");
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update visibility",
        variant: "destructive",
      });
    }
  };

  // Handle successful workshop update
  const handleWorkshopUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/workshops"] });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Workshops & Events</h1>
        </div>
        {isAdmin ? (
          <div className="mt-4 inline-block border-4 border-[#7dd3d3] rounded-lg p-1 bg-white">
            <Button asChild variant="outline" className="rounded-lg border-0">
              <Link href="/workshop-pricing">
                Workshop Pricing Rules
              </Link>
            </Button>
          </div>
        ) : user?.memberLevel && (
          <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm">
              As a <strong>{user.memberLevel}</strong>, you enjoy exclusive member pricing on all workshops.{" "}
              <Link href="/pricing" className="text-primary font-medium hover:underline">
                View your pricing benefits →
              </Link>
            </p>
          </div>
        )}
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
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Committee</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Capacity</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Calendar Visibility</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {workshops.map((workshop) => {
                            const committee = committees.find(c => c.id === workshop.committeeId);
                            
                            return (
                              <TableRow key={workshop.id}>
                                <TableCell className="font-medium">{workshop.title}</TableCell>
                                <TableCell>
                                  <div>{format(new Date(workshop.date), "MMM d, yyyy")}</div>
                                  {workshop.startTime && workshop.endTime && (
                                    <div className="text-xs text-muted-foreground">
                                      {workshop.startTime} - {workshop.endTime}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {committee ? (
                                    <span className="text-sm">{committee.name}</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>{workshop.isOnline ? "Online" : workshop.locationAddress || "TBA"}</TableCell>
                                <TableCell>{workshop.capacity}</TableCell>
                                <TableCell>
                                  {workshop.baseCost !== null && workshop.baseCost !== undefined ? (
                                    <div>
                                      <div className="font-medium">${(workshop.baseCost / 100).toFixed(2)}</div>
                                      {workshop.globalDiscountPercentage && workshop.globalDiscountPercentage > 0 && (
                                        <div className="text-xs text-green-600">
                                          {workshop.globalDiscountPercentage}% discount
                                        </div>
                                      )}
                                      {workshop.sponsoredBy && (
                                        <div className="text-xs text-muted-foreground">
                                          by {workshop.sponsoredBy}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Free</span>
                                  )}
                                </TableCell>
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
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={workshop.visibleToGeneralMembers || false}
                                        onCheckedChange={(checked) => 
                                          handleUpdateVisibility(workshop.id, {
                                            visibleToGeneralMembers: checked,
                                            visibleToCommitteeChairs: workshop.visibleToCommitteeChairs ?? undefined,
                                            visibleToAdmins: workshop.visibleToAdmins ?? undefined
                                          })
                                        }
                                        className="data-[state=checked]:bg-emerald-500"
                                      />
                                      <span className="text-xs">📅 Members</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={workshop.visibleToCommitteeChairs || false}
                                        onCheckedChange={(checked) => 
                                          handleUpdateVisibility(workshop.id, {
                                            visibleToGeneralMembers: workshop.visibleToGeneralMembers ?? undefined,
                                            visibleToCommitteeChairs: checked,
                                            visibleToAdmins: workshop.visibleToAdmins ?? undefined
                                          })
                                        }
                                        className="data-[state=checked]:bg-sky-500"
                                      />
                                      <span className="text-xs">📋 Chairs</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Switch
                                        checked={workshop.visibleToAdmins !== false}
                                        onCheckedChange={(checked) => 
                                          handleUpdateVisibility(workshop.id, {
                                            visibleToGeneralMembers: workshop.visibleToGeneralMembers ?? undefined,
                                            visibleToCommitteeChairs: workshop.visibleToCommitteeChairs ?? undefined,
                                            visibleToAdmins: checked
                                          })
                                        }
                                        className="data-[state=checked]:bg-purple-500"
                                      />
                                      <span className="text-xs">⚙️ Admins</span>
                                    </div>
                                  </div>
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
                            );
                          })}
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

      {/* Payment Dialog */}
      {pendingPayment && (
        <PaymentCheckoutDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          workshopId={pendingPayment.workshopId}
          workshopTitle={pendingPayment.workshopTitle}
          registrationId={pendingPayment.registrationId}
          onPaymentSuccess={handlePaymentSuccess}
        />
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

interface MembershipPricingRule {
  id: number;
  membershipLevel: string;
  percentagePaid: number;
}

function WorkshopCard({ workshop, onRegister, onEdit, isAdmin }: WorkshopCardProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const { data: committees = [] } = useQuery<any[]>({
    queryKey: ["/api/committees"],
  });
  const { data: pricingRules = [] } = useQuery<MembershipPricingRule[]>({
    queryKey: ["/api/membership-pricing-rules"],
  });
  const { user } = useAuth();

  const handleRegisterClick = async () => {
    setIsRegistering(true);
    try {
      await onRegister(workshop.id);
    } finally {
      setIsRegistering(false);
    }
  };

  const committee = committees.find(c => c.id === workshop.committeeId);

  // Calculate the price for the current user based on their membership level
  const calculatePrice = (): { finalPrice: string; baseCost: string; membershipDiscount: number; pricingRule: MembershipPricingRule | null } | null => {
    if (!workshop.baseCost || isAdmin || !user?.memberLevel) {
      return null;
    }

    const pricingRule = pricingRules.find(
      rule => rule.membershipLevel === user.memberLevel
    );

    if (!pricingRule) {
      return null;
    }

    // baseCost is in cents, convert to dollars
    const baseCostDollars = workshop.baseCost / 100;
    // Apply membership percentage
    const memberPrice = baseCostDollars * (pricingRule.percentagePaid / 100);
    // Apply global discount if any
    const globalDiscount = workshop.globalDiscountPercentage || 0;
    const finalPrice = memberPrice * (1 - globalDiscount / 100);

    return {
      finalPrice: finalPrice.toFixed(2),
      baseCost: baseCostDollars.toFixed(2),
      membershipDiscount: 100 - pricingRule.percentagePaid,
      pricingRule
    };
  };

  const priceInfo = calculatePrice();

  return (
    <Card className="h-full flex flex-col relative">
      {!workshop.baseCost || workshop.baseCost === 0 ? (
        <div className="absolute top-4 right-4 z-10">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-500 text-white shadow-lg">
            FREE
          </span>
        </div>
      ) : null}
      <CardHeader>
        <CardTitle className="line-clamp-2 pr-16">{workshop.title}</CardTitle>
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
            <span className="text-xs text-muted-foreground">{workshop.locationAddress}</span>
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
        {workshop.sponsoredBy && (
          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Sponsored by {workshop.sponsoredBy}
            </p>
          </div>
        )}
        {priceInfo ? (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Your Price:</span>
                {priceInfo.membershipDiscount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    {priceInfo.membershipDiscount}% OFF
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                {priceInfo.membershipDiscount > 0 && (
                  <span className="text-sm line-through text-muted-foreground mr-2">
                    ${priceInfo.baseCost}
                  </span>
                )}
                <span className="text-3xl font-bold text-primary">${priceInfo.finalPrice}</span>
                <span className="text-sm text-muted-foreground ml-1">CAD</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {user?.memberLevel} pricing • <Link href="/pricing" className="text-primary hover:underline">View all tiers</Link>
            </p>
            {priceInfo.finalPrice !== "0.00" && (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                Payment required after registration
              </p>
            )}
          </div>
        ) : workshop.baseCost && workshop.baseCost > 0 ? (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Base Price:</span>
              <span className="text-2xl font-bold">${(workshop.baseCost / 100).toFixed(2)} CAD</span>
            </div>
          </div>
        ) : null}
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
            data-testid="button-register-workshop"
          >
            {isRegistering ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Processing...</span>
              </>
            ) : workshop.baseCost && workshop.baseCost > 0 ? (
              "Register & Proceed to Payment"
            ) : (
              "Register Now"
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}