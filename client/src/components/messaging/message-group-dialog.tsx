import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "../ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";

// Create message group form schema
const messageGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100, "Group name cannot exceed 100 characters"),
  description: z.string().max(500, "Description cannot exceed 500 characters").optional(),
});

type MessageGroupFormValues = z.infer<typeof messageGroupSchema>;

interface MessageGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: number; // Optional for edit mode
}

export function MessageGroupDialog({ 
  open, 
  onOpenChange,
  groupId 
}: MessageGroupDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!groupId;
  
  // Form setup
  const form = useForm<MessageGroupFormValues>({
    resolver: zodResolver(messageGroupSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Create message group mutation
  const { mutate: createGroup, isPending: isCreating } = useMutation({
    mutationFn: async (values: MessageGroupFormValues) => {
      const res = await apiRequest("POST", "/api/message-groups", values);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Group created",
        description: "Your message group has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update message group mutation
  const { mutate: updateGroup, isPending: isUpdating } = useMutation({
    mutationFn: async (values: MessageGroupFormValues) => {
      const res = await apiRequest("PATCH", `/api/message-groups/${groupId}`, values);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Group updated",
        description: "The message group has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: MessageGroupFormValues) {
    if (isEditMode) {
      updateGroup(values);
    } else {
      createGroup(values);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Message Group" : "Create Message Group"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Update the details of your message group" 
              : "Create a new message group to send messages to multiple members at once"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter group name" {...field} />
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter group description" 
                      className="resize-none"
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isCreating || isUpdating}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isCreating || isUpdating}
              >
                {(isCreating || isUpdating) ? <LoadingSpinner size="sm" /> : isEditMode ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}