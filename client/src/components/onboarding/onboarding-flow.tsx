import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { Check, ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const MEMBER_LEVELS = ["Affiliate", "Associate", "Companion", "Full Life", "Full", "Student"];
const GENDERS = ["Female", "Male", "Non-Binary", "Other"];
const ETHNICITIES = [
  "Black (e.g., African, Afro-Caribbean, Afro-Canadian)",
  "East Asian (e.g., China, South Korea, Japan, Taiwan)",
  "Indigenous (e.g., First Nations, Métis, Inuit)",
  "Latino/Latina/Latinx (Latin American)",
  "South Asian (e.g., India, Bangladesh, Sri Lanka)",
  "Southeast Asian (e.g., Indonesia, Philippines, Vietnam)",
  "White (European descent)"
];

const LOCATIONS = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", 
  "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia", 
  "Nunavut", "Ontario", "Prince Edward Island", "Quebec", 
  "Saskatchewan", "Yukon", "International"
];

// Schema validation for each step
const step1Schema = z.object({
  memberLevel: z.string().optional(), // Member level is read-only, no validation needed
  location: z.string().min(1, "Please select your location"),
});

const step2Schema = z.object({
  languages: z.string().min(3, "Please enter complete language names (e.g., English, French)").refine(
    (val) => {
      // Check if each language name is at least 3 characters 
      const languages = val.split(',').map(lang => lang.trim());
      return languages.every(lang => lang.length >= 3);
    },
    {
      message: "Each language must be spelled out completely",
    }
  ),
});

const step3Schema = z.object({
  gender: z.string().min(1, "Please select your gender"),
  lgbtq2Status: z.string(),
  bipocStatus: z.string().min(1, "Please select yes or no"),
  ethnicity: z.array(z.string()).min(1, "Please select at least one ethnicity"),
});

const onboardingSchemas = [step1Schema, step2Schema, step3Schema];

const ONBOARDING_STEPS = [
  {
    title: "Welcome to CSC Member Portal",
    description: "Let's get started by setting up your membership level and location.",
    fields: ["memberLevel", "location"],
  },
  {
    title: "Languages and Communication",
    description: "What languages do you speak? This helps us connect you with other members.",
    fields: ["languages"],
  },
  {
    title: "Demographic Information",
    description: "This information helps us better understand our membership and ensure diversity and inclusion.",
    fields: ["gender", "lgbtq2Status", "bipocStatus", "ethnicity"],
  }
];

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Store member level from verification if available
  const [memberLevelInfo, setMemberLevelInfo] = useState<string | null>(null);
  
  // Get member level from localStorage if available (set during verification)
  useEffect(() => {
    const verifiedMemberLevel = localStorage.getItem('verified_member_level');
    if (verifiedMemberLevel) {
      setMemberLevelInfo(verifiedMemberLevel);
      // Clear it after reading
      localStorage.removeItem('verified_member_level');
    }
  }, []);

  const form = useForm({
    resolver: zodResolver(onboardingSchemas[currentStep]),
    defaultValues: {
      memberLevel: memberLevelInfo || user?.memberLevel || "",
      location: user?.location || "",
      languages: user?.languages?.join(", ") || "",
      gender: user?.gender || "",
      lgbtq2Status: user?.lgbtq2Status || "prefer_not_to_answer",
      bipocStatus: user?.bipocStatus || "", // This will show placeholder initially
      ethnicity: user?.ethnicity || [],
    },
    mode: "onChange"
  });

  // Separate function to handle user profile updates
  async function updateUserProfile(userId: number, formData: any) {
    try {
      console.log(`Sending update request for user ID: ${userId}`);
      
      // Ensure we're using the auth token in the request
      // apiRequest will automatically add the auth token from localStorage
      // if it exists (see queryClient.ts implementation)
      
      // If this is the last step, set the hasCompletedOnboarding flag to true
      const isLastStep = currentStep >= ONBOARDING_STEPS.length - 1;
      const updatedData = {
        ...formData,
        ...(isLastStep && { hasCompletedOnboarding: true })
      };
      
      console.log("Sending profile data:", updatedData);
      
      const response = await apiRequest("PATCH", `/api/user/${userId}`, updatedData);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Profile update failed:", response.status, errorData);
        
        if (response.status === 401) {
          // Get a fresh auth token if possible
          const authToken = localStorage.getItem('csc_auth_token');
          if (authToken) {
            console.log("Auth token found but request still failed. Token may be invalid.");
          }
          
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please log in again to continue.",
            variant: "destructive",
          });
          return false;
        }
        
        throw new Error(errorData.error || `Server error (${response.status})`);
      }
      
      console.log("Profile update request completed successfully");
      
      // Force refresh user data
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });

      if (currentStep < ONBOARDING_STEPS.length - 1) {
        // Move to next step
        setCurrentStep(currentStep + 1);
      } else {
        // Onboarding complete
        toast({
          title: "Onboarding Complete",
          description: "Your profile has been set up successfully!",
        });
        
        // Clear auth token and redirect to login
        setTimeout(() => {
          console.log("Onboarding complete, clearing auth token and redirecting to login");
          localStorage.removeItem('csc_auth_token');
          // Set flag for auth page to detect redirect from onboarding
          localStorage.setItem('onboardingComplete', 'true');
          window.location.href = '/auth'; // Use direct navigation to force a full page refresh
        }, 1500); // Short delay to allow toast to be seen
      }
      return true;
    } catch (apiError: any) {
      console.error("API request failed:", apiError);
      let errorMessage = "Failed to update profile.";
      
      if (apiError.status === 401) {
        errorMessage = "Your session has expired. Please log in again.";
      } else if (apiError.message) {
        errorMessage = `Error: ${apiError.message}`;
      }
      
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      return false;
    }
  }

  // Function to handle the "Next" button click for form validation
  const handleNextStep = () => {
    // Trigger validation for the current step
    form.trigger().then(isValid => {
      if (isValid) {
        if (currentStep < ONBOARDING_STEPS.length - 1) {
          // Move to next step if form is valid
          setCurrentStep(currentStep + 1);
        } else {
          // Submit the form if on the last step
          form.handleSubmit(onSubmit)();
        }
      } else {
        // Display toast notification if validation fails
        toast({
          title: "Form Validation Error",
          description: "Please fill in all required fields before proceeding.",
          variant: "destructive",
        });
        
        // Log errors for debugging
        console.log("Form validation errors:", form.formState.errors);
      }
    });
  };

  async function onSubmit(data: any) {
    try {
      setIsSubmitting(true);
      
      // Process languages from comma-separated string to array
      const processedData = {
        ...data,
        languages: data.languages ? data.languages.split(",").map((lang: string) => lang.trim()).filter(Boolean) : [],
      };
      
      console.log("Submitting onboarding data:", processedData);

      // First check session validity with a simple request
      try {
        // Get auth token
        const authToken = localStorage.getItem('csc_auth_token');
        const headers: HeadersInit = {};
        
        // Add auth token if available
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
          console.log("Adding auth token to session check request");
        }
        
        const sessionCheck = await fetch("/api/user", {
          credentials: "include",
          headers
        });
        
        if (!sessionCheck.ok) {
          console.warn("Session check failed, user not authenticated");
          // Try to refresh auth state
          await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          
          toast({
            title: "Authentication Error",
            description: "Your session has expired. Please log in again before continuing with onboarding.",
            variant: "destructive",
          });
          return;
        }
        const userData = await sessionCheck.json();
        console.log("Session valid, continuing with user:", userData);
        
        // Use the ID from the fresh request
        if (userData && userData.id) {
          return await updateUserProfile(userData.id, processedData);
        }
      } catch (error) {
        console.error("Error checking session:", error);
      }
      
      // Fallback to user context if the direct check fails
      if (user?.id) {
        console.log("Using user context ID:", user.id);
        return await updateUserProfile(user.id, processedData);
      }
      
      // If we get here, we couldn't find a valid user ID
      console.error("User ID is undefined - not authenticated");
      toast({
        title: "Authentication Error",
        description: "You need to be logged in to complete onboarding. Please try logging in again.",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Onboarding error:", error);
      toast({
        title: "Update Failed",
        description: error instanceof Error 
          ? `Error: ${error.message}` 
          : "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentStepData = ONBOARDING_STEPS[currentStep];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <CardTitle>{currentStepData.title}</CardTitle>
          <div className="flex-1 h-2 bg-secondary rounded-full">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{
                width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%`,
              }}
            />
          </div>
        </div>
        <CardDescription>{currentStepData.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {currentStepData.fields.includes("memberLevel") && (
              <FormField
                control={form.control}
                name="memberLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Member Level</FormLabel>
                    {/* Always show member level as read-only for existing members */}
                    <div className="relative">
                      <Input 
                        {...field} 
                        disabled 
                        className="pr-10 bg-muted"
                        value={field.value || 'Not specified'}
                      />
                      <div className="absolute right-3 top-2.5 text-green-600">
                        <Check size={16} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Member level from CSC database
                      </p>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {currentStepData.fields.includes("location") && (
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Geographic Location</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LOCATIONS.map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {currentStepData.fields.includes("languages") && (
              <FormField
                control={form.control}
                name="languages"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Languages Spoken (comma-separated)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="English, French, ..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {currentStepData.fields.includes("gender") && (
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GENDERS.map((gender) => (
                          <SelectItem key={gender} value={gender}>
                            {gender}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {currentStepData.fields.includes("lgbtq2Status") && (
              <FormField
                control={form.control}
                name="lgbtq2Status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LGBTQ2+ Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "prefer_not_to_answer"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select LGBTQ2+ status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="prefer_not_to_answer">Prefer not to answer</SelectItem>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {currentStepData.fields.includes("bipocStatus") && (
              <FormField
                control={form.control}
                name="bipocStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BIPOC Status</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        
                        const ethnicityField = form.getValues("ethnicity") || [];
                        const whiteEthnicity = "White (European descent)";
                        
                        // If BIPOC status is set to "No"
                        if (value === "No") {
                          // Keep only White ethnicity, remove all others
                          const newEthnicity = ethnicityField.includes(whiteEthnicity) 
                            ? [whiteEthnicity] 
                            : ethnicityField.length > 0 ? [whiteEthnicity] : [];
                            
                          form.setValue("ethnicity", newEthnicity);
                        }
                        // If BIPOC status is set to "Yes"
                        else if (value === "Yes") {
                          // Remove White ethnicity if it was selected
                          if (ethnicityField.includes(whiteEthnicity)) {
                            const newEthnicity = ethnicityField.filter(e => e !== whiteEthnicity);
                            form.setValue("ethnicity", newEthnicity);
                          }
                          
                          // If no ethnicities are selected after removing White, set a default
                          // Uncomment this if you want to auto-select a default ethnicity
                          /* if (form.getValues("ethnicity").length === 0) {
                            form.setValue("ethnicity", ["Black (e.g., African, Afro-Caribbean, Afro-Canadian)"]);
                          } */
                        }
                      }} 
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select BIPOC status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {field.value === "No" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Note: Selecting "No" will only allow "White (European descent)" as ethnicity
                      </p>
                    )}
                    {field.value === "Yes" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Note: Selecting "Yes" will not allow "White (European descent)" as ethnicity
                      </p>
                    )}
                  </FormItem>
                )}
              />
            )}

            {currentStepData.fields.includes("ethnicity") && (
              <FormField
                control={form.control}
                name="ethnicity"
                render={({ field }) => {
                  const bipocStatus = form.getValues("bipocStatus");
                  const isWhiteEthnicity = (ethnicity: string) => ethnicity === "White (European descent)";
                  
                  return (
                    <FormItem>
                      <FormLabel>Ethnicity (Select all that apply)</FormLabel>
                      <div className="grid gap-2">
                        {ETHNICITIES.map((ethnicity) => {
                          // If BIPOC Status is "No", only allow White ethnicity
                          // If BIPOC Status is "Yes", don't allow White ethnicity
                          const isDisabled = 
                            (bipocStatus === "No" && !isWhiteEthnicity(ethnicity)) || 
                            (bipocStatus === "Yes" && isWhiteEthnicity(ethnicity));
                          
                          return (
                            <div key={ethnicity} className="flex items-center space-x-2">
                              <Checkbox
                                checked={field.value.includes(ethnicity)}
                                disabled={isDisabled}
                                onCheckedChange={(checked) => {
                                  // First update the ethnicity value
                                  const newValue = checked
                                    ? [...field.value, ethnicity]
                                    : field.value.filter((e: string) => e !== ethnicity);
                                  field.onChange(newValue);
                                  
                                  // If selecting a non-White ethnicity, set BIPOC Status to "Yes"
                                  if (checked && !isWhiteEthnicity(ethnicity)) {
                                    form.setValue("bipocStatus", "Yes");
                                    
                                    // If there was White ethnicity selected, remove it
                                    if (field.value.some(e => isWhiteEthnicity(e))) {
                                      field.onChange(newValue.filter(e => !isWhiteEthnicity(e)));
                                    }
                                  } 
                                  // If selecting White ethnicity and no other ethnicity is selected, set BIPOC Status to "No"
                                  else if (checked && isWhiteEthnicity(ethnicity) && newValue.length === 1) {
                                    form.setValue("bipocStatus", "No");
                                    
                                    // Remove any non-White ethnicities that might have been selected
                                    field.onChange([ethnicity]);
                                  } 
                                  // If unchecking all ethnicities, don't change BIPOC status
                                  else if (newValue.length === 0) {
                                    // Do nothing - let user select BIPOC status
                                  }
                                  // If unchecking White and there are other ethnicities, set BIPOC Status to "Yes"
                                  else if (!checked && isWhiteEthnicity(ethnicity) && newValue.some(e => !isWhiteEthnicity(e))) {
                                    form.setValue("bipocStatus", "Yes");
                                  }
                                }}
                              />
                              <label className={`text-sm ${isDisabled ? "text-gray-400" : ""}`}>
                                {ethnicity}
                                {isDisabled && bipocStatus === "No" && " (Select 'Yes' for BIPOC Status first)"}
                                {isDisabled && bipocStatus === "Yes" && " (Not available with BIPOC Status 'Yes')"}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}

            <div className="flex justify-between">
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                >
                  Back
                </Button>
              )}
              <Button
                type="button" 
                className="ml-auto"
                disabled={isSubmitting}
                onClick={currentStep === ONBOARDING_STEPS.length - 1 ? 
                  form.handleSubmit(onSubmit) : 
                  handleNextStep
                }
              >
                {isSubmitting ? (
                  <LoadingSpinner size="sm" className="mr-2" />
                ) : currentStep === ONBOARDING_STEPS.length - 1 ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                {currentStep === ONBOARDING_STEPS.length - 1 ? "Complete" : "Next"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}