import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Workshop } from "@shared/schema";

// Schema for workshop editing
const editWorkshopSchema = z.object({
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

type EditWorkshopFormValues = z.infer<typeof editWorkshopSchema>;

interface EditWorkshopDialogProps {
  workshop: Workshop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkshopUpdated: () => void;
}

export default function EditWorkshopDialog({
  workshop,
  open,
  onOpenChange,
  onWorkshopUpdated,
}: EditWorkshopDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch committees for dropdown
  const { data: committees = [] } = useQuery<any[]>({
    queryKey: ["/api/committees"],
  });

  // Form definition
  const form = useForm<EditWorkshopFormValues>({
    resolver: zodResolver(editWorkshopSchema),
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

  // Update form when workshop changes
  useEffect(() => {
    if (workshop) {
      const workshopDate = new Date(workshop.date);
      
      form.reset({
        title: workshop.title,
        description: workshop.description,
        date: workshopDate,
        startTime: workshop.startTime || "",
        endTime: workshop.endTime || "",
        capacity: workshop.capacity,
        committeeId: workshop.committeeId || undefined,
        locationAddress: workshop.locationAddress || "",
        materials: workshop.materials || "",
        // Convert cents to dollars for display
        baseCost: workshop.baseCost !== null && workshop.baseCost !== undefined ? workshop.baseCost / 100 : 0,
        globalDiscountPercentage: workshop.globalDiscountPercentage ?? 0,
        sponsoredBy: workshop.sponsoredBy || "",
      });
    }
  }, [workshop, form]);

  // Update workshop mutation
  const updateWorkshopMutation = useMutation({
    mutationFn: async (values: EditWorkshopFormValues) => {
      if (!workshop) throw new Error("No workshop to update");

      const updateData = {
        title: values.title,
        description: values.description,
        date: values.date.toISOString(),
        startTime: values.startTime || null,
        endTime: values.endTime || null,
        capacity: values.capacity,
        committeeId: values.committeeId || null,
        locationAddress: values.locationAddress || null,
        materials: values.materials || null,
        // Convert dollars to cents, preserve zero values using nullish coalescing
        baseCost: values.baseCost !== undefined && values.baseCost !== null ? Math.round(values.baseCost * 100) : null,
        globalDiscountPercentage: values.globalDiscountPercentage ?? 0,
        sponsoredBy: values.sponsoredBy || null,
      };

      const response = await apiRequest("PATCH", `/api/workshops/${workshop.id}`, updateData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update workshop");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Workshop Updated",
        description: "The workshop has been successfully updated.",
      });
      
      // Invalidate and refetch workshops
      queryClient.invalidateQueries({ queryKey: ["/api/workshops"] });
      
      onWorkshopUpdated();
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update workshop",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (values: EditWorkshopFormValues) => {
    setIsSubmitting(true);
    updateWorkshopMutation.mutate(values);
  };

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Workshop</DialogTitle>
          <DialogDescription>
            Update the workshop details. You can modify any field including past workshops.
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
                      placeholder="Describe what this workshop covers..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
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
                        disabled={false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Enter maximum participants"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum number of participants
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Updating...
                  </>
                ) : (
                  "Update Workshop"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}