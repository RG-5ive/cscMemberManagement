import { useAuth } from "@/hooks/use-auth";
import { UserTable } from "@/components/admin/user-table";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { MessageList } from "@/components/messaging/message-list";
import { MessageGroupList } from "@/components/messaging/message-group-list";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Users, Calendar } from "lucide-react";
import AddMemberDialog from "@/components/admin/add-member-dialog";
import { EnhancedCalendar } from "@/components/ui/enhanced-calendar";


// Assuming Message[] and Workshop[] are defined elsewhere
type Message = any; //Replace any with the actual Message type
type Workshop = any; //Replace any with the actual Workshop type
type MemberData = {
  members: Array<{
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    memberNumber: string;
  }>;
};

type MemberProfile = {
  member: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    memberNumber: string;
    category: string;
  };
};

export default function Dashboard() {
  const { user } = useAuth();
  const [location] = useLocation();
  const isAdminRoute = location.startsWith('/admin');
  
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({ 
    queryKey: ["/api/messages"]
  });

  const { data: workshops = [], isLoading: workshopsLoading } = useQuery<Workshop[]>({ 
    queryKey: ["/api/workshops"]
  });

  // Fetch current user's member profile to get the real name
  const { data: memberProfile } = useQuery<MemberProfile>({
    queryKey: ["/api/user/member-profile"],
    enabled: !!user?.email,
  });

  // Only require onboarding for regular users, not admins
  const needsOnboarding = user?.role !== "admin" && !user?.hasCompletedOnboarding && !isAdminRoute;

  // Helper function to generate proper portal email format
  const generatePortalEmail = (firstName: string, lastName: string, portalType: 'admin' | 'chair' | 'member') => {
    const name = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
    switch (portalType) {
      case 'admin':
        return `${name}.admin@csc.ca`;
      case 'chair':
        return `${name}.chair@csc.ca`;
      default:
        return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com`; // or actual member email
    }
  };

  // Get display name and email for welcome message
  const getDisplayInfo = () => {
    // First, try to get name from member profile (this has the real names)
    const memberInfo = memberProfile?.member;
    
    // Determine the name to display
    let displayName = 'User';
    if (memberInfo?.firstName && memberInfo?.lastName) {
      // Use the name from the member profile (real name)
      displayName = `${memberInfo.firstName} ${memberInfo.lastName}`;
    } else if (user?.firstName && user?.lastName) {
      // Fallback to user table name
      displayName = `${user.firstName} ${user.lastName}`;
    } else if (user?.username) {
      // Extract name from email/username for admin/chair accounts
      const username = user.username;
      if (username.includes('@csc.ca')) {
        const namePart = username.split('@')[0];
        if (namePart.includes('.admin')) {
          const name = namePart.replace('.admin', '').replace(/\./g, ' ');
          displayName = name.split(' ').map(part => 
            part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          ).join(' ');
        } else if (namePart.includes('.chair')) {
          const name = namePart.replace('.chair', '').replace('.div.chair', '').replace(/\./g, ' ');
          displayName = name.split(' ').map(part => 
            part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          ).join(' ');
        }
      }
    }
    
    return {
      name: displayName,
      email: user?.email || user?.username
    };
  };

  const { name: displayName, email: displayEmail } = getDisplayInfo();

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto py-3 sm:py-6 px-2 sm:px-4 lg:px-6">
        {needsOnboarding ? (
          <OnboardingFlow />
        ) : (
          <>

            {user?.role === "admin" || user?.username?.includes(".admin@csc.ca") ? (
              // Admin Dashboard with Quick Access Cards
              <AdminDashboard />
            ) : isAdminRoute ? (
              // Fallback Admin Dashboard
              <div>
                <div className="mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold">CSC Admin Dashboard</h2>
                </div>

                <Tabs defaultValue="members">
                  <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 gap-1 p-1">
                    <TabsTrigger value="members" className="px-2 sm:px-4 py-2 text-xs sm:text-sm">
                      <span className="hidden sm:inline">Members</span>
                      <span className="sm:hidden">Members</span>
                    </TabsTrigger>
                    <TabsTrigger value="users" className="px-2 sm:px-4 py-2 text-xs sm:text-sm">
                      <span className="hidden sm:inline">System Users</span>
                      <span className="sm:hidden">Users</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="members">
                    <Card className="mb-6">
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle>CSC Membership Management</CardTitle>
                          <div className="flex gap-2">
                            <Button asChild>
                              <Link href="/admin/members">
                                <Users className="h-4 w-4 mr-2" />
                                Manage Members
                              </Link>
                            </Button>
                            <AddMemberDialog />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground font-medium">
                          Use the main navigation to manage members and view detailed statistics.
                        </p>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="users">
                    <Card>
                      <CardHeader>
                        <CardTitle>User Management</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <UserTable />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                {/* Calendar Section for Admin */}
                <div className="mt-6">
                  <EnhancedCalendar readOnly={false} />
                </div>
              </div>
            ) : (
              // Member Portal Dashboard - Focus on messaging and events
              <div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold">CSC Member Portal</h2>
                  <div className="flex gap-2">
                    <Button asChild variant="outline">
                      <Link href="/workshops">Workshops</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/profile">My Profile</Link>
                    </Button>
                  </div>
                </div>

                <div className="mb-6">
                  <Card className="bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600">
                    <CardContent className="pt-6">
                      <div className="flex items-center mb-4">
                        <Users className="h-7 w-7 mr-3 text-primary" />
                        <div>
                          <h3 className="text-xl font-medium">Welcome to the CSC Member Portal, {displayName}</h3>
                          <p className="text-muted-foreground font-medium">
                            Signed in as: {displayEmail}
                          </p>
                          <p className="text-muted-foreground mt-1">
                            Access exclusive content, workshops, events, and stay connected with the community
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>



                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Upcoming Workshops</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {workshopsLoading ? (
                        <div className="flex justify-center py-8">
                          <LoadingSpinner size="lg" />
                        </div>
                      ) : workshops && workshops.length > 0 ? (
                        workshops.map((workshop) => (
                          <div key={workshop.id} className="p-4 border rounded mb-2">
                            <h3 className="font-medium">{workshop.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {workshop.description}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground py-6 text-center">
                          No upcoming workshops available at this time.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Calendar Section for Members */}
                  <EnhancedCalendar readOnly={true} />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}