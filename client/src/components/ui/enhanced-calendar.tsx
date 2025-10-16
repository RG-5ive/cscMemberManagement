import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin, Users, Calendar as CalendarIcon, Eye, EyeOff, Edit2, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarEvent } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface CalendarProps {
  readOnly?: boolean;
}

interface LocalCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  time: string;
  location: string | null;
  type: 'meeting' | 'workshop' | 'event' | 'deadline';
  attendees?: string[];
  createdBy: number;
  visibleToGeneralMembers?: boolean;
  visibleToCommitteeChairs?: boolean;
  visibleToAdmins?: boolean;
}

export function EnhancedCalendar({ readOnly = false }: CalendarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<LocalCalendarEvent | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    time: '09:00',
    location: '',
    type: 'meeting' as const,
    date: new Date(),
    attendees: [] as string[]
  });

  const canEdit = !readOnly && (user?.role === 'admin' || user?.role === 'committee_chair' || user?.role === 'committee_cochair');
  const isAdmin = user?.role === 'admin';

  // Fetch calendar events from API
  const { data: calendarEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ["/api/calendar-events"],
  });

  // Fetch workshops to display in calendar
  const { data: workshops = [] } = useQuery({
    queryKey: ["/api/workshops"],
  });

  // Fetch committees for displaying committee names
  const { data: committees = [] } = useQuery<any[]>({
    queryKey: ["/api/committees"],
  });

  // Transform database events to calendar format
  const events: LocalCalendarEvent[] = [
    // Calendar events from database
    ...(Array.isArray(calendarEvents) ? calendarEvents.map((event: any) => ({
      ...event,
      date: new Date(event.date),
      id: event.id.toString(),
      attendees: event.attendees || []
    })) : []),
    // Workshop events
    ...(Array.isArray(workshops) ? workshops.map((workshop: any) => {
      const committee = committees.find(c => c.id === workshop.committeeId);
      const timeDisplay = workshop.startTime && workshop.endTime 
        ? `${workshop.startTime} - ${workshop.endTime}` 
        : format(new Date(workshop.date), 'HH:mm');
      
      const attendeeInfo = [];
      if (workshop.capacity) {
        attendeeInfo.push(`Capacity: ${workshop.capacity}`);
      }
      if (committee) {
        attendeeInfo.push(`Committee: ${committee.name}`);
      }

      return {
        id: `workshop-${workshop.id}`,
        title: workshop.title,
        description: workshop.description || '',
        date: new Date(workshop.date),
        time: timeDisplay,
        location: workshop.locationAddress || workshop.locationDetails || 'TBD',
        type: 'workshop' as const,
        attendees: attendeeInfo,
        createdBy: 0, // System created
        visibleToGeneralMembers: true,
        visibleToCommitteeChairs: true,
        visibleToAdmins: true
      };
    }) : [])
  ];

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(event.date, date));
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-blue-500';
      case 'workshop': return 'bg-green-500';
      case 'event': return 'bg-purple-500';
      case 'deadline': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleCreateEvent = async () => {
    if (!user || !newEvent.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Event title is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      const eventData = {
        title: newEvent.title.trim(),
        description: newEvent.description?.trim() || null,
        date: (selectedDate || new Date()).toISOString(),
        time: newEvent.time || '09:00',
        location: newEvent.location?.trim() || null,
        type: newEvent.type || 'meeting',
        attendees: newEvent.attendees.filter(a => a.trim() !== '')
      };

      console.log('Creating event with data:', eventData);

      await apiRequest('/api/calendar-events', 'POST', eventData);

      await queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      
      setNewEvent({
        title: '',
        description: '',
        time: '09:00',
        location: '',
        type: 'meeting',
        date: new Date(),
        attendees: []
      });
      setShowAddEvent(false);
      setSelectedDate(null);

      toast({
        title: "Event Created",
        description: "Calendar event created successfully. Initially visible to admins and committee chairs only.",
      });
    } catch (error) {
      console.error('Calendar event creation error:', error);
      toast({
        title: "Error",
        description: `Failed to create calendar event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const handleUpdateVisibility = async (eventId: string, visibility: any) => {
    if (!isAdmin) return;

    try {
      console.log('Updating event visibility:', { eventId, visibility });
      
      const response = await fetch(`/api/calendar-events/${eventId}/visibility`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(visibility)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update event visibility');
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      
      const actionText = visibility.visibleToGeneralMembers ? "posted to general membership" : "removed from general membership";
      toast({
        title: "Visibility Updated",
        description: `Event has been ${actionText}.`,
      });
    } catch (error) {
      console.error('Visibility update error:', error);
      toast({
        title: "Error",
        description: `Failed to update event visibility: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!user) return;

    try {
      await apiRequest(`/api/calendar-events/${eventId}`, 'DELETE');
      await queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      
      setSelectedEvent(null);
      setShowEditEvent(false);

      toast({
        title: "Event Deleted",
        description: "Calendar event deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete calendar event.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {isAdmin ? 'Master Calendar' : 'Calendar'}
            {isAdmin && (
              <Badge variant="secondary" className="ml-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                Admin Control Center
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[140px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Event
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Calendar Event</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={newEvent.title}
                        onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Event title"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newEvent.description}
                        onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Event description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="date">Date</Label>
                        <Input
                          id="date"
                          type="date"
                          value={format(selectedDate || newEvent.date, 'yyyy-MM-dd')}
                          onChange={(e) => {
                            const newDate = new Date(e.target.value);
                            setNewEvent(prev => ({ ...prev, date: newDate }));
                            setSelectedDate(newDate);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="time">Time</Label>
                        <Input
                          id="time"
                          type="time"
                          value={newEvent.time}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={newEvent.location}
                        onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="Event location"
                      />
                    </div>
                    <div>
                      <Label htmlFor="type">Type</Label>
                      <Select value={newEvent.type} onValueChange={(value) => setNewEvent(prev => ({ ...prev, type: value as any }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="workshop">Workshop</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="deadline">Deadline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        📋 <strong>Master Calendar:</strong> New events are created in the Master Calendar and visible only to administrators and committee chairs initially. 
                        You can publish events to Member Calendar and Committee Calendar after creation using the visibility controls.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowAddEvent(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateEvent} disabled={!newEvent.title}>
                        Create Event
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => {
              const dayEvents = getEventsForDate(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentDate);
              
              return (
                <div
                  key={index}
                  className={`
                    min-h-[80px] p-1 border rounded cursor-pointer transition-colors
                    ${isSelected ? 'bg-primary/10 border-primary' : 'border-border hover:bg-muted/50'}
                    ${!isCurrentMonth ? 'opacity-50' : ''}
                    ${isToday(day) ? 'bg-red-50 border-red-300' : ''}
                  `}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-sm ${isToday(day) ? 'font-bold text-red-600' : ''}`}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event, eventIndex) => (
                      <div
                        key={eventIndex}
                        className={`text-xs p-1 rounded text-white truncate ${getEventColor(event.type)}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                          setShowEditEvent(true);
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={showEditEvent} onOpenChange={setShowEditEvent}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${selectedEvent ? getEventColor(selectedEvent.type) : ''}`} />
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  {format(selectedEvent.date, 'MMMM d, yyyy')} at {selectedEvent.time}
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    {selectedEvent.location}
                  </div>
                )}
                {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4" />
                    {selectedEvent.attendees.join(', ')}
                  </div>
                )}
              </div>
              {selectedEvent.description && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                </div>
              )}
              
              {/* Admin Master Calendar Controls */}
              {isAdmin && !selectedEvent.id.startsWith('workshop-') && (
                <div className="border-t pt-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 p-4 rounded-lg -mx-2">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Master Calendar - Publish Event To:
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Control which calendars receive this event. Toggle to publish or unpublish.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-md border border-emerald-200 dark:border-emerald-800">
                      <div className="flex-1">
                        <Label htmlFor="general-members" className="text-sm font-medium">
                          📅 Member Calendar
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedEvent.visibleToGeneralMembers ? 'Published to all members' : 'Not published'}
                        </p>
                      </div>
                      <div className="relative">
                        <Switch
                          id="general-members"
                          checked={selectedEvent.visibleToGeneralMembers || false}
                          onCheckedChange={(checked) => 
                            handleUpdateVisibility(selectedEvent.id, {
                              visibleToGeneralMembers: checked,
                              visibleToCommitteeChairs: selectedEvent.visibleToCommitteeChairs,
                              visibleToAdmins: selectedEvent.visibleToAdmins
                            })
                          }
                          className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-gray-300"
                        />
                        {selectedEvent.visibleToGeneralMembers && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-md border border-sky-200 dark:border-sky-800">
                      <div className="flex-1">
                        <Label htmlFor="committee-chairs" className="text-sm font-medium">
                          📋 Committee Calendar
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedEvent.visibleToCommitteeChairs ? 'Published to chairs & co-chairs' : 'Not published'}
                        </p>
                      </div>
                      <div className="relative">
                        <Switch
                          id="committee-chairs"
                          checked={selectedEvent.visibleToCommitteeChairs || false}
                          onCheckedChange={(checked) => 
                            handleUpdateVisibility(selectedEvent.id, {
                              visibleToGeneralMembers: selectedEvent.visibleToGeneralMembers,
                              visibleToCommitteeChairs: checked,
                              visibleToAdmins: selectedEvent.visibleToAdmins
                            })
                          }
                          className="data-[state=checked]:bg-sky-500 data-[state=unchecked]:bg-gray-300"
                        />
                        {selectedEvent.visibleToCommitteeChairs && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-sky-400 rounded-full animate-pulse" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-3 rounded-md border border-violet-200 dark:border-violet-800">
                      <div className="flex-1">
                        <Label htmlFor="admins" className="text-sm font-medium">
                          ⚙️ Admin Calendar
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedEvent.visibleToAdmins ? 'Published to administrators' : 'Not published'}
                        </p>
                      </div>
                      <div className="relative">
                        <Switch
                          id="admins"
                          checked={selectedEvent.visibleToAdmins !== false}
                          onCheckedChange={(checked) => 
                            handleUpdateVisibility(selectedEvent.id, {
                              visibleToGeneralMembers: selectedEvent.visibleToGeneralMembers,
                              visibleToCommitteeChairs: selectedEvent.visibleToCommitteeChairs,
                              visibleToAdmins: checked
                            })
                          }
                          className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-300"
                        />
                        {selectedEvent.visibleToAdmins && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-400 rounded-full animate-pulse" />
                        )}
                      </div>
                    </div>
                    
                    {/* Post to Membership Button */}
                    <div className="mt-4 pt-3 border-t">
                      {!selectedEvent.visibleToGeneralMembers ? (
                        <Button
                          onClick={() => 
                            handleUpdateVisibility(selectedEvent.id, {
                              visibleToGeneralMembers: true,
                              visibleToCommitteeChairs: selectedEvent.visibleToCommitteeChairs,
                              visibleToAdmins: selectedEvent.visibleToAdmins
                            })
                          }
                          className="w-full bg-green-600 hover:bg-green-700 text-white transform transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                          size="sm"
                        >
                          <span className="animate-pulse mr-2">📢</span>
                          Post to Membership
                        </Button>
                      ) : (
                        <div className="text-center transform transition-all duration-500">
                          <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-medium mb-2">
                            <span className="animate-pulse">✓</span>
                            Posted to General Membership
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                          </div>
                          <Button
                            onClick={() => 
                              handleUpdateVisibility(selectedEvent.id, {
                                visibleToGeneralMembers: false,
                                visibleToCommitteeChairs: selectedEvent.visibleToCommitteeChairs,
                                visibleToAdmins: selectedEvent.visibleToAdmins
                              })
                            }
                            variant="outline"
                            size="sm"
                            className="mt-2 transform transition-all duration-200 hover:scale-105 active:scale-95"
                          >
                            Remove from Membership
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                {(isAdmin || selectedEvent.createdBy === user?.id) && !selectedEvent.id.startsWith('workshop-') && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowEditEvent(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}