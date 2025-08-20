import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

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
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
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

  // Form definition
  const form = useForm<WorkshopFormValues>({
    resolver: zodResolver(workshopSchema),
    defaultValues: {
      title: "",
      description: "",
      date: new Date(),
      capacity: 20,
    },
  });

  // Create workshop mutation
  const createWorkshopMutation = useMutation({
    mutationFn: async (values: WorkshopFormValues) => {
      // Convert the date to an ISO string for reliable server-side parsing
      const formattedValues = {
        ...values,
        date: values.date.toISOString(),
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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Create New Workshop</DialogTitle>
          <DialogDescription>
            Fill in the details for the new workshop event.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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