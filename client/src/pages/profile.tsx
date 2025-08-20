import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DemographicChangeRequestForm } from "@/components/profile/demographic-change-request-form";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

// Contact information form schema
const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phoneNumber: z.string().optional(),
  alternateEmail: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  // Check for pending demographic change requests
  const { data: pendingRequests = [] } = useQuery<any[]>({
    queryKey: ['/api/demographic-change-requests/user', user?.id],
    enabled: !!user?.id,
  });

  // Contact form
  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phoneNumber: user?.phoneNumber || "",
      alternateEmail: user?.alternateEmail || "",
      emergencyContact: user?.emergencyContact || "",
      emergencyPhone: user?.emergencyPhone || "",
    },
  });

  const onContactSubmit = async (data: ContactFormValues) => {
    setIsUpdating(true);
    try {
      const response = await apiRequest("POST", "/api/user/update", {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber || null,
        alternateEmail: data.alternateEmail || null,
        emergencyContact: data.emergencyContact || null,
        emergencyPhone: data.emergencyPhone || null,
      });

      if ((response as any)?.needsVerification) {
        setNeedsVerification(true);
        setVerificationSent(true);
        toast({
          title: "Verification Required",
          description: "A verification email has been sent to your new email address.",
        });
      } else {
        toast({
          title: "Profile Updated",
          description: "Your contact information has been successfully updated.",
        });
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const resendVerification = async () => {
    try {
      await apiRequest("POST", "/api/user/resend-verification", {
        userId: user?.id
      });
      toast({
        title: "Verification Email Resent",
        description: "A new verification email has been sent to your new email address.",
      });
    } catch (error) {
      toast({
        title: "Failed to Resend",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto py-3 sm:py-6 px-2 sm:px-4 lg:px-6">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6">My Profile</h1>
        
        <Tabs defaultValue="contact" className="w-full">
          <TabsList className="mb-4 sm:mb-6 grid w-full grid-cols-2">
            <TabsTrigger value="contact" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Contact Information</span>
              <span className="sm:hidden">Contact</span>
            </TabsTrigger>
            <TabsTrigger value="demographics" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Demographics</span>
              <span className="sm:hidden">Demographics</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Contact Information Tab */}
          <TabsContent value="contact">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>
                  Update your contact details. Changing your email will require verification.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {needsVerification && verificationSent && (
                  <div className="mb-6 p-4 border rounded-md bg-yellow-50 border-yellow-200 text-yellow-800">
                    <h3 className="font-medium mb-2">Email Verification Required</h3>
                    <p className="text-sm mb-3">
                      We've sent a verification link to your new email address. Please verify it to complete the email update.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={resendVerification}
                    >
                      Resend Verification Email
                    </Button>
                  </div>
                )}
                
                <Form {...contactForm}>
                  <form onSubmit={contactForm.handleSubmit(onContactSubmit)} className="space-y-6">
                    {/* Name fields */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={contactForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={contactForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={contactForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Email Address</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={contactForm.control}
                      name="alternateEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alternate Email Address (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={contactForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input {...field} type="tel" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="border-t pt-5 mt-6">
                      <h3 className="text-lg font-medium mb-4">Emergency Contact Information</h3>
                      
                      <div className="grid sm:grid-cols-2 gap-4">
                        <FormField
                          control={contactForm.control}
                          name="emergencyContact"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Emergency Contact Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={contactForm.control}
                          name="emergencyPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Emergency Contact Phone</FormLabel>
                              <FormControl>
                                <Input {...field} type="tel" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="mt-4 w-full sm:w-auto"
                      disabled={isUpdating}
                    >
                      {isUpdating ? 
                        <><LoadingSpinner size="sm" className="mr-2" /> Updating...</> : 
                        "Update Contact Information"
                      }
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Demographics Tab */}
          <TabsContent value="demographics">
            {/* Show pending requests notification */}
            {pendingRequests.length > 0 && (
              <Alert className="mb-6 bg-blue-50 border-blue-200">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  You have {pendingRequests.length} pending demographic change request{pendingRequests.length === 1 ? '' : 's'} 
                  awaiting approval from the Diversity Committee.
                </AlertDescription>
              </Alert>
            )}
            <DemographicChangeRequestForm />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}