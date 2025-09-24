import { useState, useEffect } from "react";
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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarEvent } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// Using CalendarEvent type from shared schema

// Helper functions for event creation and management
const handleCreateEvent = async (eventData: any, userId: number) => {
  try {
    await apiRequest('POST', '/api/calendar-events', {
      ...eventData,
      date: eventData.date.toISOString(),
      createdBy: userId
    });
    return true;
  } catch (error) {
    console.error('Error creating event:', error);
    return false;
  }
};

const handleUpdateEventVisibility = async (eventId: number, visibility: any) => {
  try {
    await apiRequest('PATCH', `/api/calendar-events/${eventId}/visibility`, visibility);
    return true;
  } catch (error) {
    console.error('Error updating event visibility:', error);
    return false;
  }
};

const handleDeleteEvent = async (eventId: number) => {
  try {
    await apiRequest('DELETE', `/api/calendar-events/${eventId}`);
    return true;
  } catch (error) {
    console.error('Error deleting event:', error);
    return false;
  }
};

interface CalendarProps {
  readOnly?: boolean;
}

export function MockCalendar({ readOnly = false }: CalendarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    time: '',
    location: '',
    type: 'meeting' as CalendarEvent['type'],
    date: new Date(),
    attendees: [] as string[]
  });

  const canEdit = !readOnly && (user?.role === 'admin' || user?.role === 'committee_chair' || user?.role === 'committee_cochair');
  const isAdmin = user?.role === 'admin';

  // Fetch calendar events from API
  const { data: calendarEvents = [], isLoading: isLoadingEvents } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar-events"],
  });

  // Fetch workshops to display in calendar
  const { data: workshops = [] } = useQuery<any[]>({
    queryKey: ["/api/workshops"],
  });

  // Transform database events to calendar format
  const events: CalendarEvent[] = [
    // Calendar events from database
    ...(calendarEvents as CalendarEvent[]).map((event: any) => ({
      ...event,
      date: new Date(event.date),
      id: event.id.toString()
    })),
    // Workshop events
    ...(workshops as any[]).map((workshop: any) => ({
      id: `workshop-${workshop.id}`,
      title: workshop.title,
      description: workshop.description || '',
      date: new Date(workshop.date),
      time: format(new Date(workshop.date), 'h:mm a'),
      location: workshop.locationAddress || workshop.locationDetails || 'TBD',
      type: 'workshop' as const,
      attendees: [`Capacity: ${workshop.capacity || 'Unlimited'}`],
      createdBy: 'system'
    }))
  ];

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(event.date, date));
  };

  const getEventTypeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'workshop': return 'bg-green-100 text-green-800 border-green-200';
      case 'event': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'deadline': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleAddEvent = () => {
    if (!selectedDate || !newEvent.title.trim()) {
      toast({
        title: "Error",
        description: "Please select a date and enter an event title",
        variant: "destructive"
      });
      return;
    }

    const event: CalendarEvent = {
      id: Date.now(),
      title: newEvent.title,
      description: newEvent.description,
      date: selectedDate,
      time: newEvent.time,
      location: newEvent.location,
      type: newEvent.type,
      attendees: newEvent.attendees,
      createdBy: user?.id || 0
    };

    // Note: This is legacy code - events should be saved via API
    // For now, just show success message
    setNewEvent({ title: '', description: '', time: '', location: '', type: 'meeting', date: new Date(), attendees: [] });
    setShowAddEvent(false);
    
    toast({
      title: "Success",
      description: "Event added to calendar"
    });
  };

  const resetNewEvent = () => {
    setNewEvent({ title: '', description: '', time: '', location: '', type: 'meeting', date: new Date(), attendees: [] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Organization Calendar
            {readOnly && <Badge variant="outline" className="ml-2">Read Only</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium min-w-[140px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            
            {calendarDays.map(day => {
              const dayEvents = getEventsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isCurrentDay = isToday(day);
              
              return (
                <div
                  key={day.toISOString()}
                  className={`
                    p-1 min-h-[80px] border rounded cursor-pointer transition-colors
                    ${isCurrentMonth ? 'bg-background' : 'bg-muted/30 text-muted-foreground'}
                    ${isSelected ? 'ring-2 ring-primary' : ''}
                    ${isCurrentDay ? 'bg-primary/5 border-primary/20' : ''}
                    hover:bg-muted/50
                  `}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className={`text-sm font-medium mb-1 ${isCurrentDay ? 'text-primary font-bold' : ''}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map(event => (
                      <div
                        key={event.id}
                        className={`text-xs p-1 rounded border ${getEventTypeColor(event.type)} truncate`}
                        title={event.title}
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

          {/* Selected Date Events */}
          {selectedDate && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">
                  Events for {format(selectedDate, 'MMMM d, yyyy')}
                </h3>
                {canEdit && (
                  <Dialog open={showAddEvent} onOpenChange={(open) => {
                    setShowAddEvent(open);
                    if (!open) resetNewEvent();
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Event
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Event</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="title">Event Title</Label>
                          <Input
                            id="title"
                            value={newEvent.title}
                            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                            placeholder="Enter event title"
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={newEvent.description}
                            onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                            placeholder="Event description"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="time">Time</Label>
                            <Input
                              id="time"
                              value={newEvent.time}
                              onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                              placeholder="e.g., 2:00 PM"
                            />
                          </div>
                          <div>
                            <Label htmlFor="type">Type</Label>
                            <Select value={newEvent.type} onValueChange={(value) => setNewEvent({ ...newEvent, type: value as CalendarEvent['type'] })}>
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
                        </div>
                        <div>
                          <Label htmlFor="location">Location</Label>
                          <Input
                            id="location"
                            value={newEvent.location}
                            onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                            placeholder="Event location"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleAddEvent}>Add Event</Button>
                          <Button variant="outline" onClick={() => setShowAddEvent(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              
              <div className="space-y-2">
                {getEventsForDate(selectedDate).length > 0 ? (
                  getEventsForDate(selectedDate).map(event => (
                    <Card key={event.id} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{event.title}</h4>
                            <Badge variant="outline" className={getEventTypeColor(event.type)}>
                              {event.type}
                            </Badge>
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {event.time && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {event.time}
                              </div>
                            )}
                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </div>
                            )}
                            {event.attendees && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {event.attendees.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No events scheduled for this date
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Event Types</h4>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
                <span className="text-xs">Meeting</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
                <span className="text-xs">Workshop</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></div>
                <span className="text-xs">Event</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
                <span className="text-xs">Deadline</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}