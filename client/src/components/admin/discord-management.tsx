import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  MessageSquare, 
  Users, 
  Settings, 
  Plus, 
  Hash, 
  Volume2, 
  MessageCircle, 
  Megaphone,
  Shield,
  UserPlus,
  Trash2,
  Edit
} from "lucide-react";

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  memberCount?: number;
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  memberCount: number;
}

interface DiscordServerInfo {
  name: string;
  memberCount: number;
  channels: DiscordChannel[];
  roles: DiscordRole[];
}

export function DiscordManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState("text");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("");
  const [newRolePermissions, setNewRolePermissions] = useState("member");
  
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");

  // Fetch Discord server info
  const { data: serverInfo, isLoading: serverLoading } = useQuery<DiscordServerInfo>({
    queryKey: ["/api/discord/server-info"],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Check bot status
  const { data: botStatus } = useQuery<{ connected: boolean; error?: string }>({
    queryKey: ["/api/discord/status"],
    refetchInterval: 10000 // Check status every 10 seconds
  });

  // Create channel mutation
  const createChannelMutation = useMutation({
    mutationFn: async (channelData: { name: string; type: string; description?: string }) => {
      return apiRequest("POST", "/api/discord/channels", channelData);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Channel created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/discord/server-info"] });
      setNewChannelName("");
      setNewChannelDescription("");
      setNewChannelType("text");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create channel", variant: "destructive" });
    }
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (roleData: { name: string; color?: string; permissions: string }) => {
      return apiRequest("POST", "/api/discord/roles", roleData);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Role created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/discord/server-info"] });
      setNewRoleName("");
      setNewRoleColor("");
      setNewRolePermissions("member");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create role", variant: "destructive" });
    }
  });

  // Send announcement mutation
  const sendAnnouncementMutation = useMutation({
    mutationFn: async (announcementData: { title: string; message: string; channelId?: string }) => {
      return apiRequest("POST", "/api/discord/announcements", announcementData);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Announcement sent successfully!" });
      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setSelectedChannel("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send announcement", variant: "destructive" });
    }
  });

  // Start/restart bot mutation
  const toggleBotMutation = useMutation({
    mutationFn: async (action: 'start' | 'stop') => {
      return apiRequest("POST", `/api/discord/bot/${action}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discord/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discord/server-info"] });
    }
  });

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    
    await createChannelMutation.mutateAsync({
      name: newChannelName,
      type: newChannelType,
      description: newChannelDescription
    });
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    
    await createRoleMutation.mutateAsync({
      name: newRoleName,
      color: newRoleColor,
      permissions: newRolePermissions
    });
  };

  const handleSendAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) return;
    
    await sendAnnouncementMutation.mutateAsync({
      title: announcementTitle,
      message: announcementMessage,
      channelId: selectedChannel
    });
  };

  const getChannelIcon = (type: number) => {
    switch (type) {
      case 2: return <Volume2 className="h-4 w-4" />; // Voice
      case 15: return <MessageCircle className="h-4 w-4" />; // Forum
      case 5: return <Megaphone className="h-4 w-4" />; // Announcement
      default: return <Hash className="h-4 w-4" />; // Text
    }
  };

  const getChannelTypeName = (type: number) => {
    switch (type) {
      case 2: return "Voice";
      case 15: return "Forum";
      case 5: return "Announcement";
      default: return "Text";
    }
  };

  if (serverLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bot Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Discord Bot Status
              </CardTitle>
              <CardDescription>
                Monitor and control the CSC Discord bot
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={botStatus?.connected ? "default" : "destructive"}>
                {botStatus?.connected ? "Connected" : "Disconnected"}
              </Badge>
              <Button
                onClick={() => toggleBotMutation.mutate(botStatus?.connected ? 'stop' : 'start')}
                variant={botStatus?.connected ? "destructive" : "default"}
                disabled={toggleBotMutation.isPending}
              >
                {botStatus?.connected ? "Stop Bot" : "Start Bot"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {botStatus?.error && (
          <CardContent>
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-sm text-destructive">{botStatus.error}</p>
            </div>
          </CardContent>
        )}
      </Card>

      {serverInfo && (
        <>
          {/* Server Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Server Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{serverInfo.memberCount}</div>
                  <div className="text-sm text-muted-foreground">Total Members</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{serverInfo.channels.length}</div>
                  <div className="text-sm text-muted-foreground">Channels</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{serverInfo.roles.length}</div>
                  <div className="text-sm text-muted-foreground">Roles</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Management Tabs */}
          <Tabs defaultValue="channels" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="channels">Channels</TabsTrigger>
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
              <TabsTrigger value="moderation">Moderation</TabsTrigger>
            </TabsList>

            {/* Channels Tab */}
            <TabsContent value="channels">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Create Channel */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Create Channel
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="channel-name">Channel Name</Label>
                      <Input
                        id="channel-name"
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        placeholder="general-discussion"
                      />
                    </div>
                    <div>
                      <Label htmlFor="channel-type">Channel Type</Label>
                      <Select value={newChannelType} onValueChange={setNewChannelType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text Channel</SelectItem>
                          <SelectItem value="voice">Voice Channel</SelectItem>
                          <SelectItem value="forum">Forum Channel</SelectItem>
                          <SelectItem value="announcement">Announcement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="channel-description">Description (Optional)</Label>
                      <Textarea
                        id="channel-description"
                        value={newChannelDescription}
                        onChange={(e) => setNewChannelDescription(e.target.value)}
                        placeholder="Channel description..."
                        rows={2}
                      />
                    </div>
                    <Button 
                      onClick={handleCreateChannel}
                      disabled={createChannelMutation.isPending}
                      className="w-full"
                    >
                      {createChannelMutation.isPending ? "Creating..." : "Create Channel"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Channel List */}
                <Card>
                  <CardHeader>
                    <CardTitle>Existing Channels</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {serverInfo.channels.map((channel) => (
                        <div key={channel.id} className="flex items-center gap-3 p-2 rounded-lg border">
                          {getChannelIcon(channel.type)}
                          <div className="flex-1">
                            <div className="font-medium">{channel.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {getChannelTypeName(channel.type)}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Roles Tab */}
            <TabsContent value="roles">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Create Role */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Create Role
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="role-name">Role Name</Label>
                      <Input
                        id="role-name"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="Committee Member"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role-permissions">Permission Level</Label>
                      <Select value={newRolePermissions} onValueChange={setNewRolePermissions}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="moderator">Moderator</SelectItem>
                          <SelectItem value="committee">Committee Member</SelectItem>
                          <SelectItem value="member">General Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="role-color">Color (Optional)</Label>
                      <Input
                        id="role-color"
                        value={newRoleColor}
                        onChange={(e) => setNewRoleColor(e.target.value)}
                        placeholder="#0099FF"
                      />
                    </div>
                    <Button 
                      onClick={handleCreateRole}
                      disabled={createRoleMutation.isPending}
                      className="w-full"
                    >
                      {createRoleMutation.isPending ? "Creating..." : "Create Role"}
                    </Button>
                  </CardContent>
                </Card>

                {/* Role List */}
                <Card>
                  <CardHeader>
                    <CardTitle>Existing Roles</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {serverInfo.roles.map((role) => (
                        <div key={role.id} className="flex items-center gap-3 p-2 rounded-lg border">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99AAB5' }}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{role.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {role.memberCount} members
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Announcements Tab */}
            <TabsContent value="announcements">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4" />
                    Send Announcement
                  </CardTitle>
                  <CardDescription>
                    Broadcast important messages to your Discord community
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="announcement-title">Announcement Title</Label>
                    <Input
                      id="announcement-title"
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                      placeholder="Important CSC Update"
                    />
                  </div>
                  <div>
                    <Label htmlFor="announcement-channel">Target Channel (Optional)</Label>
                    <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel or use default" />
                      </SelectTrigger>
                      <SelectContent>
                        {serverInfo.channels
                          .filter(ch => ch.type === 0 || ch.type === 5) // Text or Announcement channels
                          .map(channel => (
                            <SelectItem key={channel.id} value={channel.id}>
                              {getChannelIcon(channel.type)} {channel.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="announcement-message">Message</Label>
                    <Textarea
                      id="announcement-message"
                      value={announcementMessage}
                      onChange={(e) => setAnnouncementMessage(e.target.value)}
                      placeholder="Your announcement message here..."
                      rows={4}
                    />
                  </div>
                  <Button 
                    onClick={handleSendAnnouncement}
                    disabled={sendAnnouncementMutation.isPending}
                    className="w-full"
                  >
                    {sendAnnouncementMutation.isPending ? "Sending..." : "Send Announcement"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Moderation Tab */}
            <TabsContent value="moderation">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Moderation Tools
                    </CardTitle>
                    <CardDescription>
                      Manage Discord server moderation settings and actions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg border bg-muted/50">
                        <h4 className="font-medium mb-2">Available Commands</h4>
                        <div className="text-sm space-y-1 text-muted-foreground">
                          <p><code>/timeout @user [minutes] [reason]</code> - Timeout a member</p>
                          <p><code>/ban @user [reason]</code> - Ban a member</p>
                          <p><code>/sync-member @user email@example.com</code> - Sync Discord with CSC member</p>
                          <p><code>/link-account email@example.com</code> - Link Discord to CSC account</p>
                        </div>
                      </div>
                      
                      <div className="p-4 rounded-lg border bg-muted/50">
                        <h4 className="font-medium mb-2">Auto-Moderation Features</h4>
                        <div className="text-sm space-y-1 text-muted-foreground">
                          <p>• Spam detection and prevention</p>
                          <p>• Welcome messages for new members</p>
                          <p>• Automatic role assignment based on CSC membership</p>
                          <p>• Content filtering and message moderation</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}