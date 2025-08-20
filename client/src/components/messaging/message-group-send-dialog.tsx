import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageGroup } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "../ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";

interface MessageGroupSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
}

export function MessageGroupSendDialog({ 
  open, 
  onOpenChange,
  groupId 
}: MessageGroupSendDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  // Get group data
  const { data: group, isLoading } = useQuery<MessageGroup>({
    queryKey: ['/api/message-groups', groupId],
    enabled: open && groupId > 0,
  });

  // Send message mutation
  const { mutate: sendMessage, isPending: isSending } = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/message-groups/${groupId}/send`, { content });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Message sent",
        description: "Your message has been sent to the group",
      });
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessage(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
          <DialogDescription>
            {isLoading ? (
              <div className="flex items-center">
                <LoadingSpinner size="sm" />
                <span className="ml-2">Loading group details...</span>
              </div>
            ) : (
              group && `Send a message to all members of the ${group.name} group`
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Type your message here..."
            className="min-h-[120px]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSending}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!message.trim() || isSending}>
              {isSending ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Sending...</span>
                </>
              ) : (
                "Send Message"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}