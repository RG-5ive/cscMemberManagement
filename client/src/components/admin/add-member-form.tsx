import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// Form validation schema
const memberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  memberNumber: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  gender: z.string().optional(),
  knownAs: z.string().optional(),
  province: z.string().min(1, "Province is required"),
  affiliation: z.string().optional(),
  occupation: z.string().optional(),
  homePhone: z.string().optional(),
  cellPhone: z.string().optional(),
  website: z.string().optional(),
  webReel: z.string().optional(),
  instagram: z.string().optional(),
  isActive: z.boolean().default(true),
});

type MemberFormValues = z.infer<typeof memberSchema>;

export default function AddMemberForm({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize the form with default values
  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      memberNumber: "",
      category: "",
      gender: "",
      knownAs: "",
      province: "",
      affiliation: "",
      occupation: "",
      homePhone: "",
      cellPhone: "",
      website: "",
      webReel: "",
      instagram: "",
      isActive: true,
    },
  });

  const onSubmit = async (values: MemberFormValues) => {
    try {
      setIsSubmitting(true);
      
      // Convert camelCase to snake_case for API
      const memberData = {
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email,
        member_number: values.memberNumber || undefined,
        category: values.category,
        gender: values.gender || undefined,
        known_as: values.knownAs || undefined,
        province: values.province,
        affiliation: values.affiliation || undefined,
        occupation: values.occupation || undefined,
        home_phone: values.homePhone || undefined,
        cell_phone: values.cellPhone || undefined,
        website: values.website || undefined,
        web_reel: values.webReel || undefined,
        instagram: values.instagram || undefined,
        is_active: values.isActive,
      };
      
      const response = await apiRequest("POST", "/api/members", memberData);
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // If member exists with same email, show specific error
        if (errorData.memberId) {
          toast({
            title: "Member Already Exists",
            description: `A member with this email already exists (ID: ${errorData.memberId})`,
            variant: "destructive",
          });
        } else {
          throw new Error(errorData.error || "Failed to create member");
        }
        return;
      }
      
      const newMember = await response.json();
      
      // Show success message
      toast({
        title: "Member Created",
        description: `Successfully created new member: ${newMember.first_name} ${newMember.last_name}`,
      });
      
      // Invalidate members query cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      
      // Reset form
      form.reset();
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error creating member:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create member",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>
            
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="First name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Last name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="memberNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Member Number (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Member number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Membership Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Full">Full</SelectItem>
                      <SelectItem value="Associate">Associate</SelectItem>
                      <SelectItem value="Student">Student</SelectItem>
                      <SelectItem value="Retired">Retired</SelectItem>
                      <SelectItem value="Honorary">Honorary</SelectItem>
                      <SelectItem value="Lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Active Member</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          
          {/* Contact & Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Contact & Additional Information</h3>
            
            <FormField
              control={form.control}
              name="province"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Province</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select province" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="AB">Alberta</SelectItem>
                      <SelectItem value="BC">British Columbia</SelectItem>
                      <SelectItem value="MB">Manitoba</SelectItem>
                      <SelectItem value="NB">New Brunswick</SelectItem>
                      <SelectItem value="NL">Newfoundland and Labrador</SelectItem>
                      <SelectItem value="NS">Nova Scotia</SelectItem>
                      <SelectItem value="ON">Ontario</SelectItem>
                      <SelectItem value="PE">Prince Edward Island</SelectItem>
                      <SelectItem value="QC">Quebec</SelectItem>
                      <SelectItem value="SK">Saskatchewan</SelectItem>
                      <SelectItem value="NT">Northwest Territories</SelectItem>
                      <SelectItem value="NU">Nunavut</SelectItem>
                      <SelectItem value="YT">Yukon</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender (Optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Non-binary">Non-binary</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                      <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="knownAs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Known As (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Preferred name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="occupation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Occupation (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Occupation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="affiliation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Affiliation (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Affiliation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Contact Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="cellPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cell Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Cell phone" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="homePhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Home Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Home phone" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        {/* Web Presence */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Web Presence</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="webReel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Web Reel (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/reel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="instagram"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instagram (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="@username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        {/* Submit button */}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <LoadingSpinner className="mr-2" />
              Creating Member...
            </>
          ) : (
            "Create Member"
          )}
        </Button>
      </form>
    </Form>
  );
}