import { Message } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageGroupList } from "./message-group-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UserIcon, UsersIcon } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Get count of unread messages
  const unreadCount = messages?.filter(m => 
    !m.read && m.toUserId === user?.id
  ).length || 0;

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      await apiRequest("PATCH", `/api/messages/${messageId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark message as read",
        variant: "destructive",
      });
    },
  });

  const renderMessages = () => {
    if (isLoading) {
      return (
        <div className="h-[400px] flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    return (
      <ScrollArea className="h-[400px] w-full">
        <div className="space-y-4 p-4">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground">No messages yet</p>
          ) : (
            messages.map((message) => {
              // Determine if this is a group message
              const isGroupMessage = !!message.toGroupId;
              
              return (
                <Card
                  key={message.id}
                  className={`p-4 ${!message.read && message.toUserId === user?.id ? "bg-primary/5" : ""}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {message.fromUserId === user?.id ? "Sent" : "Received"}
                        </p>
                        {isGroupMessage && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <UsersIcon className="h-3 w-3" />
                            Group
                          </Badge>
                        )}
                        {!isGroupMessage && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <UserIcon className="h-3 w-3" />
                            Direct
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(message.createdAt || new Date()), "PPp")}
                      </p>
                    </div>
                    {!message.read && message.toUserId === user?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAsReadMutation.mutate(message.id)}
                        disabled={markAsReadMutation.isPending}
                      >
                        {markAsReadMutation.isPending ? (
                          <LoadingSpinner size="sm" className="mr-2" />
                        ) : null}
                        Mark as Read
                      </Button>
                    )}
                  </div>
                  <p className="mt-2">{message.content}</p>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    );
  };

  // Only admins can see and manage message groups
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return renderMessages();
  }

  return (
    <Tabs defaultValue="messages">
      <TabsList className="mb-4 grid w-full grid-cols-2 gap-1 p-1">
        <TabsTrigger value="messages" className="relative px-4 py-2">
          Direct Messages
          {unreadCount > 0 && (
            <Badge className="ml-2 bg-primary text-primary-foreground">{unreadCount}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="groups" className="px-4 py-2">
          Message Groups
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="messages" className="mt-0">
        {renderMessages()}
      </TabsContent>
      
      <TabsContent value="groups" className="mt-0">
        <MessageGroupList />
      </TabsContent>
    </Tabs>
  );
}