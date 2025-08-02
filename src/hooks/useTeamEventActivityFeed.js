import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { NostrContext } from '../contexts/NostrContext';
import { fetchEvents } from '../utils/nostr';
// Note: ActivityModeContext not used here since we filter by event activity type
import { useProfiles } from './useProfiles';
import { useNostr } from './useNostr';

/**
 * Hook: useTeamEventActivityFeed  
 * Fetches Kind 1301 workout records from team event participants for activity feed display
 * Filters by event activity type and date range for event-specific feeds
 * Uses event-scoped date range (event start/end) for all participants
 * Optimized for feed display with real-time updates following League's successful pattern
 * 
 * @param {Array} participants - Array of event participants with pubkeys
 * @param {string} eventDate - Event date (YYYY-MM-DD format)
 * @param {string} eventStartTime - Event start time (HH:MM format, optional)
 * @param {string} eventEndTime - Event end time (HH:MM format, optional)
 * @param {string} eventActivity - Event activity type ('run', 'walk', 'cycle')
 * @returns {Object} { feedEvents, enhancedFeedEvents, isLoading, error, refresh, lastUpdated, loadingProgress }
 */
export const useTeamEventActivityFeed = (participants = [], eventDate, eventStartTime, eventEndTime, eventActivity = 'run') => {
  const { ndk } = useContext(NostrContext);
  const { publicKey } = useNostr();
  const [feedEvents, setFeedEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Enhanced loading states for better UX (following League pattern)
  const [loadingProgress, setLoadingProgress] = useState({
    phase: 'initializing',
    participantCount: 0,
    processedEvents: 0,
    totalEvents: 0,
    message: 'Loading event participants...'
  });

  // Constants (following League's caching strategy)
  const FEED_CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes cache duration
  const MAX_EVENTS = 2000; // Limit for feed queries
  const FEED_LIMIT = 50; // Maximum number of feed events to return
  
  // Create unique cache key for this specific event
  const eventCacheKey = useMemo(() => {
    if (!eventDate || !eventActivity) return null;
    return `runstr_team_event_feed_${eventDate}_${eventActivity}_v1`;
  }, [eventDate, eventActivity]);

  // Calculate event timestamp range from date and times
  const { eventStartTimestamp, eventEndTimestamp } = useMemo(() => {
    if (!eventDate) return { eventStartTimestamp: null, eventEndTimestamp: null };
    
    const baseDate = eventDate;
    
    // If event has specific start/end times, use them
    if (eventStartTime && eventEndTime) {
      const startTimestamp = Math.floor(new Date(`${baseDate}T${eventStartTime}:00.000Z`).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(`${baseDate}T${eventEndTime}:00.000Z`).getTime() / 1000);
      return { eventStartTimestamp: startTimestamp, eventEndTimestamp: endTimestamp };
    }
    
    // For all-day events, use UTC midnight to midnight
    const startTimestamp = Math.floor(new Date(`${baseDate}T00:00:00.000Z`).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(`${baseDate}T23:59:59.999Z`).getTime() / 1000);
    
    return { eventStartTimestamp: startTimestamp, eventEndTimestamp: endTimestamp };
  }, [eventDate, eventStartTime, eventEndTime]);

  // Extract participant pubkeys
  const participantPubkeys = useMemo(() => {
    return participants.map(p => p.pubkey || p).filter(Boolean);
  }, [participants]);

  // Extract pubkeys for profile loading
  const feedEventPubkeys = useMemo(() => {
    return Array.from(new Set(feedEvents.map(event => event.pubkey).filter(Boolean)));
  }, [feedEvents]);

  // Load profiles for feed events
  const { profiles } = useProfiles(feedEventPubkeys);

  // Enhanced feed events with profile data (following League pattern)
  const enhancedFeedEvents = useMemo(() => {
    if (!feedEvents.length) return [];
    
    return feedEvents.map(event => {
      const profile = profiles?.[event.pubkey] || {};
      return {
        ...event,
        // Add profile metadata
        displayName: profile.display_name || profile.name || `Runner ${event.pubkey.slice(0, 8)}`,
        picture: profile.picture,
        about: profile.about,
        isCurrentUser: event.pubkey === publicKey,
        // Keep original profile data for advanced use cases
        profile
      };
    });
  }, [feedEvents, profiles, publicKey]);

  /**
   * Load cached feed data
   */
  const loadCachedData = useCallback(() => {
    if (!eventCacheKey) return false;
    
    try {
      const cached = localStorage.getItem(eventCacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (now - timestamp < FEED_CACHE_DURATION_MS) {
          setFeedEvents(data);
          setLastUpdated(new Date(timestamp));
          setLoadingProgress({ 
            phase: 'complete', 
            participantCount: participantPubkeys.length, 
            processedEvents: data.length, 
            totalEvents: data.length, 
            message: 'Using cached event feed' 
          });
          setIsLoading(false);
          return true;
        }
      }
    } catch (err) {
      console.error('Error loading event feed cache:', err);
    }
    return false;
  }, [eventCacheKey, participantPubkeys.length, FEED_CACHE_DURATION_MS]);

  /**
   * Save feed data to cache
   */
  const saveCachedData = useCallback((data) => {
    if (!eventCacheKey) return;
    
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(eventCacheKey, JSON.stringify(cacheData));
    } catch (err) {
      console.error('Error saving event feed cache:', err);
    }
  }, [eventCacheKey]);

  /**
   * Extract distance from event tags with proper error handling and validation
   * (Same as League implementation)
   */
  const extractDistance = useCallback((event) => {
    try {
      const distanceTag = event.tags?.find(tag => tag[0] === 'distance');
      if (!distanceTag || !distanceTag[1]) return 0;
      
      const value = parseFloat(distanceTag[1]);
      if (isNaN(value) || value < 0) return 0;
      
      const unit = distanceTag[2]?.toLowerCase() || 'km';
      
      // Add reasonable bounds checking to filter out corrupted data
      const MAX_REASONABLE_DISTANCE_KM = 500; // 500km covers ultramarathons
      const MIN_REASONABLE_DISTANCE_KM = 0.01; // 10 meters minimum
      
      // Convert to km first for validation
      let distanceInKm = value;
      switch (unit) {
        case 'mi':
        case 'mile':
        case 'miles':
          distanceInKm = value * 1.609344;
          break;
        case 'm':
        case 'meter':
        case 'meters':
          distanceInKm = value / 1000;
          break;
        case 'km':
        case 'kilometer':
        case 'kilometers':
        default:
          distanceInKm = value;
          break;
      }
      
      // Validate reasonable range
      if (distanceInKm < MIN_REASONABLE_DISTANCE_KM || distanceInKm > MAX_REASONABLE_DISTANCE_KM) {
        console.warn(`Invalid distance detected: ${value} ${unit} (${distanceInKm.toFixed(2)}km) - filtering out event ${event.id}`);
        return 0;
      }
      
      return distanceInKm;
    } catch (err) {
      console.error('Error extracting distance:', err);
      return 0;
    }
  }, []);

  /**
   * Check if event is duplicate with comprehensive validation
   * (Same as League implementation)
   */
  const isDuplicateEvent = useCallback((event, processedEvents) => {
    try {
      return processedEvents.some(existing => {
        // Primary check: exact same event ID
        if (existing.id === event.id) return true;
        
        // Secondary checks for same user
        if (existing.pubkey !== event.pubkey) return false;
        
        const existingDistance = extractDistance(existing);
        const currentDistance = extractDistance(event);
        const timeDiff = Math.abs(existing.created_at - event.created_at);
        
        // Same distance within 0.05 km and within 10 minutes
        if (Math.abs(existingDistance - currentDistance) < 0.05 && timeDiff < 600) return true;
        
        // Check duration matching
        const existingDuration = existing.tags?.find(tag => tag[0] === 'duration')?.[1];
        const currentDuration = event.tags?.find(tag => tag[0] === 'duration')?.[1];
        if (existingDuration && currentDuration && existingDuration === currentDuration && 
            Math.abs(existingDistance - currentDistance) < 0.1) return true;
        
        // Check content similarity
        if (existing.content && event.content && existing.content === event.content && 
            Math.abs(existingDistance - currentDistance) < 0.1 && timeDiff < 3600) return true;
        
        return false;
      });
    } catch (err) {
      console.error('Error checking duplicate event:', err);
      return false;
    }
  }, [extractDistance]);

  /**
   * Process events for team event feed display
   * Filters by event participants, date range, and activity type
   */
  const processEventsForFeed = useCallback((events, participantSet) => {
    try {
      const processedEvents = [];
      let duplicateCount = 0;
      let filteredCount = 0;
      
      console.log('[useTeamEventActivityFeed] Processing events:', {
        totalEvents: events.length,
        eventStartTime: eventStartTimestamp ? new Date(eventStartTimestamp * 1000).toISOString() : null,
        eventEndTime: eventEndTimestamp ? new Date(eventEndTimestamp * 1000).toISOString() : null,
        eventActivity,
        participantCount: participantSet.size
      });
      
      events.forEach(event => {
        if (!event.pubkey) {
          filteredCount++;
          return;
        }
        
        // Check if user is a team event participant
        if (!participantSet.has(event.pubkey)) {
          filteredCount++;
          return;
        }
        
        // Filter by event date range
        if (eventStartTimestamp && event.created_at < eventStartTimestamp) {
          filteredCount++;
          return;
        }
        
        if (eventEndTimestamp && event.created_at > eventEndTimestamp) {
          filteredCount++;
          return;
        }
        
        // Filter by event activity type
        const exerciseTag = event.tags?.find(tag => tag[0] === 'exercise');
        const eventActivityType = exerciseTag?.[1]?.toLowerCase();
        
        // Map activity types for consistency
        const activityMatches = {
          'run': ['run', 'running', 'jog', 'jogging'],
          'cycle': ['cycle', 'cycling', 'bike', 'biking'],  
          'walk': ['walk', 'walking', 'hike', 'hiking']
        };
        
        const acceptedActivities = activityMatches[eventActivity] || [eventActivity];
        
        if (eventActivityType && !acceptedActivities.includes(eventActivityType)) {
          filteredCount++;
          return;
        }
        
        const distance = extractDistance(event);
        if (distance <= 0) {
          filteredCount++;
          return;
        }

        // Check for duplicates
        if (isDuplicateEvent(event, processedEvents)) {
          duplicateCount++;
          return;
        }

        // Create feed-specific event object
        const feedEvent = {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          content: event.content,
          tags: event.tags,
          distance: distance,
          activityType: eventActivityType,
          // Extract common feed display data
          title: event.tags?.find(tag => tag[0] === 'title')?.[1] || '',
          duration: event.tags?.find(tag => tag[0] === 'duration')?.[1] || '',
          // Add feed-specific metadata
          displayDistance: `${distance.toFixed(1)} km`,
          displayActivity: eventActivityType || eventActivity,
          // Raw event for compatibility with Post component
          rawEvent: event
        };

        processedEvents.push(feedEvent);
      });
      
      console.log(`[useTeamEventActivityFeed] Event processing complete:`, {
        total: events.length,
        processed: processedEvents.length,
        duplicates: duplicateCount,
        filtered: filteredCount,
        eventActivity
      });
      
      // Sort by timestamp (newest first for feed)
      processedEvents.sort((a, b) => b.created_at - a.created_at);
      
      // Limit to feed size for optimal performance
      const limitedEvents = processedEvents.slice(0, FEED_LIMIT);
      
      console.log(`[useTeamEventActivityFeed] Returning ${limitedEvents.length} feed events for ${eventActivity} event`);
      
      return limitedEvents;
    } catch (err) {
      console.error('Error processing events for team event feed:', err);
      return [];
    }
  }, [extractDistance, eventActivity, eventStartTimestamp, eventEndTimestamp, FEED_LIMIT, isDuplicateEvent]);

  /**
   * Fetch fresh feed data from team event participants
   * Enhanced with progressive loading and performance optimizations
   */
  const fetchFeedData = useCallback(async () => {
    if (!ndk) {
      setError('Nostr connection not available');
      return;
    }

    if (participantPubkeys.length === 0) {
      console.log('[useTeamEventActivityFeed] No participants provided');
      setFeedEvents([]);
      setLastUpdated(new Date());
      setLoadingProgress({ 
        phase: 'complete', 
        participantCount: 0, 
        processedEvents: 0, 
        totalEvents: 0, 
        message: 'No event participants' 
      });
      setIsLoading(false);
      return;
    }

    if (!eventStartTimestamp || !eventEndTimestamp) {
      console.log('[useTeamEventActivityFeed] Invalid event date range');
      setError('Invalid event date range');
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setLoadingProgress({ 
        phase: 'fetching_participants', 
        participantCount: participantPubkeys.length, 
        processedEvents: 0, 
        totalEvents: 0, 
        message: `Found ${participantPubkeys.length} participants` 
      });

      setLoadingProgress({ 
        phase: 'fetching_events', 
        participantCount: participantPubkeys.length, 
        processedEvents: 0, 
        totalEvents: 0, 
        message: 'Fetching event activities...' 
      });

      // Fetch events from team event participants using event date range
      const events = await fetchEvents({
        kinds: [1301],
        authors: participantPubkeys,
        limit: MAX_EVENTS,
        since: eventStartTimestamp,
        until: eventEndTimestamp
      });
      
      setLoadingProgress({ 
        phase: 'processing_events', 
        participantCount: participantPubkeys.length, 
        processedEvents: 0, 
        totalEvents: events.length, 
        message: `Processing ${events.length} activities for event feed...` 
      });

      // Process events for feed display
      const feedData = processEventsForFeed(events, new Set(participantPubkeys));

      // Final update
      setFeedEvents(feedData);
      saveCachedData(feedData);
      setLastUpdated(new Date());
      setLoadingProgress({ 
        phase: 'complete', 
        participantCount: participantPubkeys.length, 
        processedEvents: feedData.length, 
        totalEvents: events.length, 
        message: 'Event feed loaded successfully' 
      });

    } catch (err) {
      console.error('Error fetching team event activity feed:', err);
      const errorMessage = err.message || 'Failed to load event activity feed';
      setError(errorMessage);
      setLoadingProgress({ 
        phase: 'complete', 
        participantCount: participantPubkeys.length, 
        processedEvents: 0, 
        totalEvents: 0, 
        message: 'Error loading event feed' 
      });
    } finally {
      setIsLoading(false);
    }
  }, [ndk, participantPubkeys, eventStartTimestamp, eventEndTimestamp, saveCachedData, processEventsForFeed]);

  /**
   * Refresh feed data
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadingProgress({ 
      phase: 'initializing', 
      participantCount: participantPubkeys.length, 
      processedEvents: 0, 
      totalEvents: 0, 
      message: 'Refreshing event feed...' 
    });
    await fetchFeedData();
  }, [fetchFeedData, participantPubkeys.length]);

  // Load cached data on mount
  useEffect(() => {
    const hasCachedData = loadCachedData();
    if (!hasCachedData) {
      fetchFeedData();
    }
  }, [loadCachedData, fetchFeedData]);

  // Refresh when participants or event parameters change
  useEffect(() => {
    setIsLoading(true);
    setLoadingProgress({ 
      phase: 'initializing', 
      participantCount: participantPubkeys.length, 
      processedEvents: 0, 
      totalEvents: 0, 
      message: 'Loading event data...' 
    });
    fetchFeedData();
  }, [fetchFeedData, participantPubkeys.length]);

  return {
    feedEvents, // Raw feed events without profile data
    enhancedFeedEvents, // Feed events with profile metadata attached
    isLoading,
    error,
    refresh,
    lastUpdated,
    loadingProgress,
    // Additional stats for debugging
    stats: {
      participantCount: participantPubkeys.length,
      eventActivity,
      eventDate,
      eventStartTime,
      eventEndTime,
      totalEvents: feedEvents.length
    }
  };
};