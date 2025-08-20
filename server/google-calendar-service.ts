import { google } from 'googleapis';

interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
}

class GoogleCalendarService {
  private oauth2Client: any;
  private calendar: any;

  constructor() {
    if (!process.env.GOOGLE_CALENDAR_CLIENT_ID || 
        !process.env.GOOGLE_CALENDAR_CLIENT_SECRET || 
        !process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
      console.warn('Google Calendar credentials not configured. Calendar features will be disabled.');
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  isConfigured(): boolean {
    return !!(this.oauth2Client && this.calendar);
  }

  async createCommitteeCalendar(committeeName: string): Promise<string | null> {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar not configured');
    }

    try {
      const response = await this.calendar.calendars.insert({
        requestBody: {
          summary: `${committeeName} Committee Calendar`,
          description: `Private calendar for ${committeeName} committee events and meetings`,
          timeZone: 'America/Toronto' // Adjust as needed
        }
      });

      return response.data.id;
    } catch (error) {
      console.error('Error creating committee calendar:', error);
      throw error;
    }
  }

  async createEvent(calendarId: string, event: CalendarEvent): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar not configured');
    }

    try {
      const response = await this.calendar.events.insert({
        calendarId: calendarId,
        requestBody: {
          summary: event.summary,
          description: event.description,
          start: event.start,
          end: event.end,
          attendees: event.attendees
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  async getEvents(calendarId: string, timeMin?: string, timeMax?: string): Promise<any[]> {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar not configured');
    }

    try {
      const response = await this.calendar.events.list({
        calendarId: calendarId,
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax,
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }

  async updateEvent(calendarId: string, eventId: string, event: Partial<CalendarEvent>): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar not configured');
    }

    try {
      const response = await this.calendar.events.update({
        calendarId: calendarId,
        eventId: eventId,
        requestBody: event
      });

      return response.data;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw error;
    }
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar not configured');
    }

    try {
      await this.calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId
      });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw error;
    }
  }

  async shareCalendarWithCommitteeMembers(calendarId: string, memberEmails: string[]): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar not configured');
    }

    try {
      for (const email of memberEmails) {
        await this.calendar.acl.insert({
          calendarId: calendarId,
          requestBody: {
            role: 'reader', // Members can view but not edit
            scope: {
              type: 'user',
              value: email
            }
          }
        });
      }
    } catch (error) {
      console.error('Error sharing calendar:', error);
      throw error;
    }
  }

  async grantChairAccess(calendarId: string, chairEmail: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar not configured');
    }

    try {
      await this.calendar.acl.insert({
        calendarId: calendarId,
        requestBody: {
          role: 'writer', // Chairs can edit
          scope: {
            type: 'user',
            value: chairEmail
          }
        }
      });
    } catch (error) {
      console.error('Error granting chair access:', error);
      throw error;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();