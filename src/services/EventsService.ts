/**
 * EventsService
 * 
 * Simplified service for querying team events across all teams.
 * This replaces the complex team events infrastructure with a simple query-based approach.
 */

import NDK, { NDKFilter, NDKKind, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
import { TeamEventDetails, KIND_NIP101_TEAM_EVENT, KIND_FITNESS_TEAM } from './nostr/NostrTeamsService';

/**
 * Simple storage for joined events (localStorage-based)
 */
export class EventJoinStorage {
  private static STORAGE_KEY = 'runstr_joined_events';

  /**
   * Join an event locally (immediate UI feedback)
   */
  static joinEvent(eventId: string, eventName: string, eventDate: string): boolean {
    try {
      const joinedEvents = this.getJoinedEvents();
      joinedEvents[eventId] = {
        eventId,
        eventName,
        eventDate,
        joinedAt: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(joinedEvents));
      console.log(`[EventJoinStorage] Joined event ${eventId}`);
      return true;
    } catch (error) {
      console.error('[EventJoinStorage] Error joining event:', error);
      return false;
    }
  }

  /**
   * Leave an event locally
   */
  static leaveEvent(eventId: string): boolean {
    try {
      const joinedEvents = this.getJoinedEvents();
      delete joinedEvents[eventId];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(joinedEvents));
      console.log(`[EventJoinStorage] Left event ${eventId}`);
      return true;
    } catch (error) {
      console.error('[EventJoinStorage] Error leaving event:', error);
      return false;
    }
  }

  /**
   * Check if user has joined an event
   */
  static hasJoinedEvent(eventId: string): boolean {
    const joinedEvents = this.getJoinedEvents();
    return eventId in joinedEvents;
  }

  /**
   * Get all joined events
   */
  static getJoinedEvents(): Record<string, any> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('[EventJoinStorage] Error reading joined events:', error);
      return {};
    }
  }

  /**
   * Get joined events for a specific date range (for workout tagging)
   */
  static getActiveEventsForDate(date: Date): Array<{ eventId: string; eventName: string }> {
    const joinedEvents = this.getJoinedEvents();
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    return Object.values(joinedEvents)
      .filter((event: any) => event.eventDate === dateString)
      .map((event: any) => ({
        eventId: event.eventId,
        eventName: event.eventName
      }));
  }
}

/**
 * Main EventsService for querying team events
 */
export class EventsService {
  /**
   * Fetch all team events from all known teams
   * This is a simplified approach that queries events broadly
   */
  static async fetchAllTeamEvents(ndk: NDK): Promise<TeamEventDetails[]> {
    if (!ndk) {
      throw new Error('NDK instance is required');
    }

    try {
      console.log('[EventsService] Fetching all team events...');

      // Query all team events (Kind 31012) - simplified approach
      const filter: NDKFilter = {
        kinds: [KIND_NIP101_TEAM_EVENT as NDKKind],
        limit: 200, // Reasonable limit for MVP
        since: Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000) // Last 30 days
      };

      const eventsSet = await ndk.fetchEvents(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        closeOnEose: true
      });

      if (!eventsSet || eventsSet.size === 0) {
        console.log('[EventsService] No events found');
        return [];
      }

      // Process events
      const events: TeamEventDetails[] = [];
      const eventsArray = Array.from(eventsSet);

      for (const rawEvent of eventsArray) {
        try {
          const processedEvent = this.processRawEvent(rawEvent);
          if (processedEvent) {
            events.push(processedEvent);
          }
        } catch (err) {
          console.warn('[EventsService] Failed to process event:', rawEvent.id, err);
        }
      }

      // Sort by date (most recent first)
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      console.log(`[EventsService] Successfully processed ${events.length} events`);
      return events;
    } catch (error) {
      console.error('[EventsService] Error fetching team events:', error);
      throw new Error('Failed to fetch team events');
    }
  }

  /**
   * Process a raw Nostr event into TeamEventDetails
   */
  private static processRawEvent(rawEvent: any): TeamEventDetails | null {
    try {
      // Extract basic fields
      const getTag = (tagName: string): string | null => {
        const tag = rawEvent.tags?.find((t: any[]) => t[0] === tagName);
        return tag?.[1] || null;
      };

      const eventId = getTag('d');
      const name = getTag('name');
      const date = getTag('date');
      
      if (!eventId || !name || !date) {
        console.warn('[EventsService] Event missing required fields:', { eventId, name, date });
        return null;
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.warn('[EventsService] Invalid date format:', date);
        return null;
      }

      const teamAIdentifier = getTag('a');
      const description = getTag('description') || undefined;
      const activity = getTag('activity') as 'run' | 'walk' | 'cycle' || 'run';
      const distanceStr = getTag('distance') || '5';
      const startTime = getTag('start_time') || undefined;
      const endTime = getTag('end_time') || undefined;

      // Parse distance with validation
      const distance = Math.max(0, parseFloat(distanceStr) || 5);

      return {
        id: eventId,
        teamAIdentifier: teamAIdentifier || '',
        name,
        description,
        activity,
        distance,
        date,
        startTime,
        endTime,
        creatorPubkey: rawEvent.pubkey || '',
        createdAt: rawEvent.created_at || 0,
        participantCount: 0 // Will be calculated separately if needed
      };
    } catch (error) {
      console.error('[EventsService] Error processing raw event:', error);
      return null;
    }
  }

  /**
   * Get event status (upcoming, active, completed)
   */
  static getEventStatus(event: TeamEventDetails): 'upcoming' | 'active' | 'completed' {
    const now = new Date();
    
    if (event.startTime && event.endTime) {
      const eventStart = new Date(`${event.date}T${event.startTime}:00`);
      const eventEnd = new Date(`${event.date}T${event.endTime}:00`);
      
      if (now > eventEnd) return 'completed';
      if (now >= eventStart && now <= eventEnd) return 'active';
      return 'upcoming';
    }
    
    // All-day event
    const eventStart = new Date(event.date + 'T00:00:00');
    const eventEnd = new Date(event.date + 'T23:59:59');
    
    if (now > eventEnd) return 'completed';
    if (now >= eventStart && now <= eventEnd) return 'active';
    return 'upcoming';
  }

  /**
   * Simple leaderboard query (to be implemented)
   * Queries 1301 workout notes with event tags from the event timeframe
   */
  static async fetchEventLeaderboard(ndk: NDK, eventId: string, eventDate: string): Promise<any[]> {
    // TODO: Implement simple 1301 workout query with event tags
    // This will query workout notes from the event date that contain the event ID tag
    console.log(`[EventsService] Leaderboard query for event ${eventId} on ${eventDate} - TODO: implement`);
    return [];
  }
}

export default EventsService;