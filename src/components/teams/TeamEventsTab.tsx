import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNostr } from '../../hooks/useNostr';
import { fetchTeamEvents, TeamEventDetails } from '../../services/nostr/NostrTeamsService';
import { 
  CACHE_KEYS, 
  CACHE_TTL, 
  loadCachedData, 
  saveCachedData, 
  clearCachedData 
} from '../../utils/teamEventsCache.js';
import CreateEventModal from '../modals/CreateEventModal';
import toast from 'react-hot-toast';

interface TeamEventsTabProps {
  teamAIdentifier: string;
  isCaptain: boolean;
  captainPubkey: string;
  teamUUID: string;
}

const TeamEventsTab: React.FC<TeamEventsTabProps> = ({ 
  teamAIdentifier, 
  isCaptain, 
  captainPubkey, 
  teamUUID 
}) => {
  const { ndk, ndkReady } = useNostr();
  const navigate = useNavigate();
  const [events, setEvents] = useState<TeamEventDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Enhanced loading states following League's progressive loading pattern
  const [loadingProgress, setLoadingProgress] = useState({
    phase: 'initializing',
    message: 'Loading team events...',
    fromCache: false
  });

  /**
   * Load cached data immediately - League's cache-first pattern
   */
  const loadCachedEvents = useCallback(() => {
    if (!teamAIdentifier) return false;
    
    try {
      const cacheKey = CACHE_KEYS.TEAM_EVENTS(teamAIdentifier);
      const cached = loadCachedData(cacheKey, CACHE_TTL.TEAM_EVENTS);
      
      if (cached) {
        setEvents(cached.data);
        setLastUpdated(cached.timestamp);
        setLoadingProgress({
          phase: 'complete',
          message: 'Using cached team events',
          fromCache: true
        });
        setIsLoading(false);
        return true;
      }
    } catch (err) {
      console.error('Error loading cached team events:', err);
    }
    return false;
  }, [teamAIdentifier]);

  /**
   * Fetch fresh events data - League's background refresh pattern
   */
  const fetchEventsData = useCallback(async () => {
    if (!ndk || !teamAIdentifier) {
      setError('Nostr connection not available');
      return;
    }

    try {
      setError(null);
      setLoadingProgress({
        phase: 'fetching',
        message: 'Fetching latest team events...',
        fromCache: false
      });

      const teamEvents = await fetchTeamEvents(ndk, teamAIdentifier);
      
      // Cache the results
      const cacheKey = CACHE_KEYS.TEAM_EVENTS(teamAIdentifier);
      saveCachedData(cacheKey, teamEvents);
      
      setEvents(teamEvents);
      setLastUpdated(new Date());
      setLoadingProgress({
        phase: 'complete',
        message: 'Team events loaded successfully',
        fromCache: false
      });

    } catch (err) {
      console.error('Error fetching team events:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load team events';
      setError(errorMessage);
      
      // Show toast only if we don't have cached data to fall back to
      if (events.length === 0) {
        toast.error('Failed to load team events');
      }
      
      setLoadingProgress({
        phase: 'complete',
        message: 'Error loading team events',
        fromCache: false
      });
    } finally {
      setIsLoading(false);
    }
  }, [ndk, teamAIdentifier, events.length]);

  /**
   * Refresh events data with cache clearing
   */
  const refreshEvents = useCallback(async () => {
    if (!teamAIdentifier) return;
    
    setIsLoading(true);
    setLoadingProgress({
      phase: 'initializing',
      message: 'Refreshing team events...',
      fromCache: false
    });
    
    // Clear cache to force fresh fetch
    const cacheKey = CACHE_KEYS.TEAM_EVENTS(teamAIdentifier);
    clearCachedData(cacheKey);
    
    await fetchEventsData();
  }, [teamAIdentifier, fetchEventsData]);

  // Load cached data immediately on mount - League's cache-first pattern
  useEffect(() => {
    const hasCachedData = loadCachedEvents();
    if (!hasCachedData) {
      fetchEventsData();
    }
  }, [loadCachedEvents, fetchEventsData]);

  // Fetch fresh data when NDK becomes ready (if we haven't already)
  useEffect(() => {
    if (ndk && ndkReady && events.length === 0 && !isLoading) {
      fetchEventsData();
    }
  }, [ndk, ndkReady, events.length, isLoading, fetchEventsData]);

  // Auto-refresh every 15 minutes like League
  useEffect(() => {
    const refreshInterval = 15 * 60 * 1000; // 15 minutes
    const interval = setInterval(() => {
      console.log('[TeamEventsTab] Auto-refreshing team events');
      fetchEventsData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchEventsData]);

  const handleEventCreated = () => {
    setShowCreateModal(false);
    // Clear cache and reload events after creation using new refresh method
    refreshEvents();
  };

  const getEventStatus = useCallback((event: TeamEventDetails): string => {
    const now = new Date();
    
    // If event has start/end times, use them for precise timing
    if (event.startTime && event.endTime) {
      // Fix: Use UTC dates to avoid timezone issues
      const eventStart = new Date(event.date + 'T' + event.startTime + ':00.000Z');
      const eventEnd = new Date(event.date + 'T' + event.endTime + ':00.000Z');
      
      if (now > eventEnd) {
        return 'completed';
      } else if (now >= eventStart && now <= eventEnd) {
        return 'active';
      } else {
        return 'upcoming';
      }
    }
    
    // For all-day events, use UTC midnight to midnight to ensure consistency
    // This ensures all users see the same event status regardless of timezone
    const eventStart = new Date(event.date + 'T00:00:00.000Z');
    const eventEnd = new Date(event.date + 'T23:59:59.999Z');
    
    if (now > eventEnd) {
      return 'completed';
    } else if (now >= eventStart && now <= eventEnd) {
      return 'active';
    } else {
      return 'upcoming';
    }
  }, []);

  const upcomingReminders = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    
    return events.filter(event => {
      const eventDate = new Date(event.date);
      const eventDateString = eventDate.toDateString();
      const status = getEventStatus(event);
      
      // Only show upcoming events or active events that started recently (within 2 hours)
      if (eventDateString === today) {
        if (status === 'active') {
          // For active events, check if they started recently (show for first 2 hours)
          if (event.startTime) {
            const eventStart = new Date(event.date + 'T' + event.startTime);
            const timeSinceStart = now.getTime() - eventStart.getTime();
            return timeSinceStart <= 2 * 60 * 60 * 1000; // 2 hours in milliseconds
          }
          return true; // Show all-day active events
        }
        return status === 'upcoming';
      }
      
      // Show tomorrow's upcoming events
      if (eventDateString === tomorrow) {
        return status === 'upcoming';
      }
      
      return false;
    });
  }, [events, getEventStatus]);

  const renderReminderBanner = () => {
    const upcomingEvents = upcomingReminders;
    
    if (upcomingEvents.length === 0) return null;

    return (
      <div className="mb-6 p-4 bg-black border border-white rounded-lg">
        <h4 className="text-sm font-medium text-text-primary mb-2">🔔 Upcoming Events</h4>
        {upcomingEvents.map(event => {
          const timeUntil = getTimeUntilEvent(event.date);
          const isToday = new Date(event.date).toDateString() === new Date().toDateString();
          
          return (
            <div key={event.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-black bg-white px-2 py-1 rounded">
                  {getActivityLabel(event.activity)}
                </span>
                <div>
                  <p className="text-text-primary font-medium">{event.name}</p>
                  <p className="text-xs text-text-muted">
                    {event.distance}km {event.activity} • {isToday ? 'Today' : 'Tomorrow'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-primary">
                  {timeUntil === 'starting soon' ? 'Starting Soon!' : `Starts ${timeUntil}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };


  const getTimeUntilEvent = useCallback((eventDate: string): string => {
    const now = new Date();
    const event = new Date(eventDate);
    const diffMs = event.getTime() - now.getTime();
    
    if (diffMs < 0) return '';
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffDays > 0) return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    if (diffMinutes > 0) return `in ${diffMinutes} min`;
    return 'starting soon';
  }, []);

  const getStatusBadge = (status: string, eventDate: string) => {
    const timeUntil = status === 'upcoming' ? getTimeUntilEvent(eventDate) : '';
    
    switch (status) {
      case 'completed':
        return (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-text-muted"></div>
            <span className="text-xs text-text-muted">Completed</span>
          </div>
        );
      case 'active':
        return (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
            <span className="text-xs text-success font-medium">Live Now</span>
          </div>
        );
      case 'upcoming':
        return (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-text-primary"></div>
            <span className="text-xs text-text-primary">
              Starts {timeUntil}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getActivityLabel = (activity: string) => {
    switch (activity) {
      case 'run':
        return 'RUN';
      case 'walk':
        return 'WALK';
      case 'cycle':
        return 'CYCLE';
      default:
        return 'RUN';
    }
  };

  if (isLoading && events.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-text-muted">{loadingProgress.message}</p>
        {loadingProgress.phase === 'fetching' && (
          <div className="mt-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto"></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderReminderBanner()}
      
      {/* Status indicator for cached data or background loading - League pattern */}
      {(loadingProgress.fromCache || error) && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm">
          <div className="flex items-center gap-2">
            {loadingProgress.fromCache && (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span className="text-yellow-400">Using cached data</span>
                {lastUpdated && (
                  <span className="text-text-muted">
                    • Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </>
            )}
            {error && !loadingProgress.fromCache && (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-red-400">Network error</span>
              </>
            )}
          </div>
          {isLoading && events.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
              <span className="text-text-muted text-xs">Refreshing...</span>
            </div>
          )}
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-text-primary">Team Events</h3>
        {isCaptain && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg transition-colors border-2 border-white focus:outline-none focus:ring-0"
          >
            Create Event
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 bg-black rounded-lg border border-white">
          <p className="text-text-muted mb-2">No events created yet.</p>
          {isCaptain && (
            <p className="text-sm text-text-muted">Create your first team event to get started!</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const status = getEventStatus(event);
            return (
              <div
                key={event.id}
                onClick={() => navigate(`/teams/${captainPubkey}/${teamUUID}/event/${event.id}`)}
                className="bg-black border border-white rounded-lg p-4 hover:bg-gray-900 transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-bold text-black bg-white px-3 py-2 rounded">
                      {getActivityLabel(event.activity)}
                    </span>
                    <div>
                      <h4 className="text-lg font-semibold text-text-primary">{event.name}</h4>
                      <p className="text-sm text-text-secondary">
                        {event.distance}km {event.activity}
                      </p>
                      {event.description && (
                        <p className="text-xs text-text-muted mt-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(status, event.date)}
                </div>
                <div className="flex justify-between items-center mt-3">
                  <p className="text-sm text-text-secondary">
                    {formatEventDate(event.date)}
                    {event.startTime && ` • ${event.startTime}`}
                    {event.endTime && ` - ${event.endTime}`}
                  </p>
                  <p className="text-sm text-text-muted">
                    {event.participantCount || 0} participants
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateEventModal
          teamAIdentifier={teamAIdentifier}
          onClose={() => setShowCreateModal(false)}
          onEventCreated={handleEventCreated}
        />
      )}
    </div>
  );
};

export default TeamEventsTab;