import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EnhancedCalendar } from "@/components/ui/enhanced-calendar";
import { ArrowLeft, Users, MessageSquare, Settings, Calendar, Video, Plus, ExternalLink } from "lucide-react";

export default function CommitteeAdminSimple() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/committee-admin");
  
  const targetCommitteeId = params?.committee ? parseInt(params.committee) : 
    new URLSearchParams(window.location.search).get('committee') ? 
    parseInt(new URLSearchParams(window.location.search).get('committee')!) : null;

  const [selectedCommitteeId, setSelectedCommitteeId] = useState<number | null>(targetCommitteeId);
  const [activeTab, setActiveTab] = useState("members");
  const [showEventForm, setShowEventForm] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([
    {
      id: '1',
      title: 'Monthly Committee Meeting',
      description: 'Regular monthly meeting to discuss ongoing projects and initiatives',
      date: '2025-06-15',
      time: '14:00',
      duration: '2 hours',
      attendees: 8,
      location: 'Conference Room A',
      type: 'meeting' as const
    },
    {
      id: '2',
      title: 'Budget Review Workshop',
      description: 'Annual budget planning and review session',
      date: '2025-06-18',
      time: '10:00',
      duration: '3 hours',
      attendees: 12,
      location: 'Training Room B',
      type: 'workshop' as const
    }
  ]);
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    duration: "1 hour",
    location: "",
    type: "meeting" as "meeting" | "workshop" | "event"
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's committee roles
  const { data: userCommitteeRoles, isLoading: isLoadingUserCommittees } = useQuery({
    queryKey: ["/api/users/me/committee-roles"],
    enabled: !!user
  });

  // Fetch all committees for reference
  const { data: allCommittees } = useQuery({
    queryKey: ["/api/committees"],
  });

  // Mock calendar event handlers
  const handleAddEvent = () => {
    setShowEventForm(true);
  };

  const handleCreateEvent = () => {
    if (!eventForm.title || !eventForm.date || !eventForm.time) {
      toast({
        title: "Missing Information",
        description: "Please fill in title, date, and time.",
        variant: "destructive",
      });
      return;
    }

    const newEvent = {
      id: (calendarEvents.length + 1).toString(),
      title: eventForm.title,
      description: eventForm.description,
      date: eventForm.date,
      time: eventForm.time,
      duration: eventForm.duration,
      location: eventForm.location,
      type: eventForm.type,
      attendees: Math.floor(Math.random() * 15) + 3 // Mock attendee count
    };

    setCalendarEvents([...calendarEvents, newEvent]);
    setEventForm({
      title: "",
      description: "",
      date: "",
      time: "",
      duration: "1 hour",
      location: "",
      type: "meeting"
    });
    setShowEventForm(false);
    
    toast({
      title: "Event Created",
      description: "Calendar event has been successfully added.",
    });
  };

  const handleEventClick = (event: any) => {
    toast({
      title: event.title,
      description: `${event.date} at ${event.time} - ${event.location || 'No location specified'}`,
    });
  };

  // Handle committee selection from URL
  useEffect(() => {
    if (targetCommitteeId && userCommitteeRoles) {
      console.log("Setting committee ID to:", targetCommitteeId);
      setSelectedCommitteeId(targetCommitteeId);
    }
  }, [targetCommitteeId, userCommitteeRoles]);

  // Loading state
  if (isLoadingUserCommittees) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Loading committee data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Find selected committee info
  const selectedCommittee = allCommittees?.find((c: any) => c.id === selectedCommitteeId);
  const userRole = userCommitteeRoles?.find((role: any) => role.committeeId === selectedCommitteeId);

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setLocation('/committee-selection')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Committees
        </Button>
        
        {selectedCommittee && (
          <div>
            <h1 className="text-3xl font-bold">{selectedCommittee.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={userRole?.role?.name === 'Chair' ? 'default' : 'secondary'}>
                {userRole?.role?.name || 'Member'}
              </Badge>
              <span className="text-muted-foreground">Committee Management</span>
            </div>
          </div>
        )}
      </div>

      {!selectedCommitteeId ? (
        <Card>
          <CardHeader>
            <CardTitle>No Committee Selected</CardTitle>
            <CardDescription>
              Please select a committee to manage from the committee selection page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/committee-selection')}>
              Go to Committee Selection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Roles
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="meetings" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Meetings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Committee Members</CardTitle>
                <CardDescription>
                  Manage members of the {selectedCommittee?.name} committee
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Member management functionality will be implemented here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Committee Messages</CardTitle>
                <CardDescription>
                  Send announcements and messages to all committee members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Committee messaging functionality will be implemented here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Role Management</CardTitle>
                <CardDescription>
                  Assign and manage roles for committee members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Role management functionality will be implemented here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <EnhancedCalendar readOnly={false} />
          </TabsContent>

          <TabsContent value="meetings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Zoom Meetings</CardTitle>
                <CardDescription>
                  Start instant meetings or schedule committee calls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button className="w-full sm:w-auto">
                    <Video className="h-4 w-4 mr-2" />
                    Start Instant Meeting
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto ml-0 sm:ml-2">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Meeting
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Zoom integration requires API credentials to be configured.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}