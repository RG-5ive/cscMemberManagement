import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Schema for workshop creation
const workshopSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  date: z.date(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
  committeeId: z.coerce.number().optional(),
  locationAddress: z.string().optional(),
  materials: z.string().optional(),
  baseCost: z.coerce.number().min(0, "Cost must be at least 0").optional(),
  globalDiscountPercentage: z.coerce.number().min(0).max(100, "Discount must be between 0-100").optional(),
  sponsoredBy: z.string().optional(),
});

type WorkshopFormValues = z.infer<typeof workshopSchema>;

interface CreateWorkshopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkshopCreated: () => void;
}

export default function CreateWorkshopDialog({
  open,
  onOpenChange,
  onWorkshopCreated,
}: CreateWorkshopDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch committees for dropdown
  const { data: committees = [] } = useQuery<any[]>({
    queryKey: ["/api/committees"],
  });

  // Form definition
  const form = useForm<WorkshopFormValues>({
    resolver: zodResolver(workshopSchema),
    defaultValues: {
      title: "",
      description: "",
      date: new Date(),
      startTime: "",
      endTime: "",
      capacity: 20,
      committeeId: undefined,
      locationAddress: "",
      materials: "",
      baseCost: 0,
      globalDiscountPercentage: 0,
      sponsoredBy: "",
    },
  });

  // Create workshop mutation
  const createWorkshopMutation = useMutation({
    mutationFn: async (values: WorkshopFormValues) => {
      // Convert the date to an ISO string and dollars to cents
      const formattedValues = {
        ...values,
        date: values.date.toISOString(),
        // Convert dollars to cents (baseCost is stored as integer in database)
        baseCost: values.baseCost !== undefined && values.baseCost !== null ? Math.round(values.baseCost * 100) : null,
      };
      
      // Log the data being sent to the server for debugging
      console.log("Sending workshop data:", formattedValues);
      
      const response = await apiRequest("POST", "/api/workshops", formattedValues);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create workshop");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Workshop Created",
        description: "The workshop has been created successfully",
      });
      form.reset();
      onWorkshopCreated();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Workshop",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  async function onSubmit(values: WorkshopFormValues) {
    setIsSubmitting(true);
    try {
      await createWorkshopMutation.mutateAsync(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Workshop</DialogTitle>
          <DialogDescription>
            Fill in the details for the new workshop event.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 overflow-y-auto flex-1 pr-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workshop Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter workshop title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the workshop purpose and what participants will learn"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date and Time</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP p")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                        <div className="p-3 border-t border-border">
                          <Input
                            type="time"
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(':');
                              const newDate = new Date(field.value);
                              newDate.setHours(parseInt(hours), parseInt(minutes));
                              field.onChange(newDate);
                            }}
                            defaultValue={format(field.value, "HH:mm")}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormDescription>
                      Maximum number of attendees
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input 
                        type="time" 
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input 
                        type="time" 
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="committeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Committee (Optional)</FormLabel>
                  <Select
                    value={field.value?.toString()}
                    onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a committee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">None</SelectItem>
                      {committees.map((committee) => (
                        <SelectItem key={committee.id} value={committee.id.toString()}>
                          {committee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Which committee is organizing this workshop
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="locationAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter workshop location" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="materials"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Materials Needed (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="List any materials participants should bring"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="baseCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Cost (CAD)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        {...field}
                        data-testid="input-baseCost"
                      />
                    </FormControl>
                    <FormDescription>
                      Cost before member discounts
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="globalDiscountPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sponsorship Discount (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        min="0"
                        max="100"
                        {...field}
                        data-testid="input-globalDiscountPercentage"
                      />
                    </FormControl>
                    <FormDescription>
                      Additional discount 0-100%
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="sponsoredBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sponsored By (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter sponsor name or organization"
                      {...field}
                      data-testid="input-sponsoredBy"
                    />
                  </FormControl>
                  <FormDescription>
                    Who is financially supporting this workshop?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Creating...</span>
                  </>
                ) : (
                  "Create Workshop"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}