import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNostr } from '../hooks/useNostr';
import { 
  fetchTeamEvents, 
  fetchTeamEventById,
  TeamEventDetails, 
  joinTeamEvent, 
  leaveTeamEvent, 
  fetchEventParticipants,
  isUserParticipating,
  fetchEventParticipation, 
  fetchEventActivities,
  EventParticipation 
} from '../services/nostr/NostrTeamsService';
import { DisplayName } from '../components/shared/DisplayName';
import { Post } from '../components/Post';
import EditEventModal from '../components/modals/EditEventModal';
import { teamEventsCache, CACHE_KEYS, CACHE_TTL } from '../utils/teamEventsCache.js';
import toast from 'react-hot-toast';

const TeamEventDetailPage: React.FC = () => {
  const { captainPubkey, teamUUID, eventId } = useParams<{
    captainPubkey: string;
    teamUUID: string;
    eventId: string;
  }>();
  const navigate = useNavigate();
  const { ndk, ndkReady, publicKey, fetchWithTimeout, ensureConnection, ndkStatus } = useNostr();


  const [event, setEvent] = useState<TeamEventDetails | null>(null);
  const [participants, setParticipants] = useState<EventParticipation[]>([]);
  const [participantPubkeys, setParticipantPubkeys] = useState<string[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isParticipating, setIsParticipating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [loadingState, setLoadingState] = useState<'loading' | 'success' | 'error' | 'timeout' | 'cancelled'>('loading');
  
  // Construct team identifier from URL params
  const teamAIdentifier = `33404:${captainPubkey}:${teamUUID}`;

  // Check if current user is team captain
  const isCaptain = publicKey === captainPubkey;

  // Load event activities
  const loadEventActivities = useCallback(async (eventDetails: TeamEventDetails, participantPubkeys: string[]) => {
    if (!ndk || participantPubkeys.length === 0) return;

    setIsLoadingActivities(true);
    try {
      const eventActivities = await fetchEventActivities(
        ndk, 
        eventDetails.id, 
        teamAIdentifier, 
        participantPubkeys, 
        eventDetails.date,
        eventDetails.endTime ? eventDetails.date : undefined
      );

      // Convert NDK events to a format compatible with Post component
      const formattedActivities = eventActivities.map(activity => ({
        ...activity,
        kind: activity.kind,
        content: activity.content,
        created_at: activity.created_at,
        pubkey: activity.pubkey,
        tags: activity.tags,
        author: {
          pubkey: activity.pubkey
        }
      }));

      setActivities(formattedActivities);
    } catch (error) {
      console.error('Error loading event activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [ndk, teamAIdentifier]);

  // Progressive loading functions
  const loadEventDetails = useCallback(async () => {
    if (!eventId || !teamAIdentifier || !ndk) return;

    const cacheKey = CACHE_KEYS.EVENT_DETAILS(teamAIdentifier, eventId);
    
    // Check cache first
    const cachedEvent = teamEventsCache.get<TeamEventDetails>(cacheKey);
    if (cachedEvent) {
      setEvent(cachedEvent);
      setLoadingState('success');
      setIsLoadingEvent(false);
      return cachedEvent;
    }

    setIsLoadingEvent(true);
    setLoadingStatus('Loading event details...');

    try {
      // Ensure connection
      if (!ndkStatus?.isConnected) {
        setLoadingStatus('Connecting to Nostr relays...');
        const connected = await ensureConnection(15000);
        if (!connected) {
          throw new Error('Failed to connect to Nostr relays');
        }
      }

      const foundEvent = await fetchWithTimeout(
        (ndk) => fetchTeamEventById(ndk, teamAIdentifier, eventId),
        10000
      );

      if (!foundEvent) {
        setLoadingState('error');
        setLoadingStatus('Event not found');
        toast.error('Event not found');
        setTimeout(() => navigate(`/teams/${captainPubkey}/${teamUUID}`), 2000);
        return null;
      }

      // Cache and set event
      teamEventsCache.set(cacheKey, foundEvent, CACHE_TTL.EVENT_DETAILS);
      setEvent(foundEvent);
      setLoadingState('success');
      setLoadingStatus('Event loaded');
      
      return foundEvent;
    } catch (error) {
      console.error('Error loading event:', error);
      setLoadingState('error');
      setLoadingStatus(`Error: ${error.message}`);
      // Remove automatic toast error - let the UI handle error display
      return null;
    } finally {
      setIsLoadingEvent(false);
    }
  }, [eventId, teamAIdentifier, ndk, ndkStatus, ensureConnection, fetchWithTimeout, navigate, captainPubkey, teamUUID]);

  const loadParticipants = useCallback(async (eventDetails: TeamEventDetails) => {
    if (!ndk || !eventId || !teamAIdentifier) return;

    const participantsCacheKey = CACHE_KEYS.EVENT_PARTICIPANTS(teamAIdentifier, eventId);
    const participationCacheKey = CACHE_KEYS.EVENT_PARTICIPATION(teamAIdentifier, eventId);

    // Check cache first
    const cachedParticipants = teamEventsCache.get<string[]>(participantsCacheKey);
    const cachedParticipation = teamEventsCache.get<EventParticipation[]>(participationCacheKey);

    if (cachedParticipants && cachedParticipation) {
      setParticipantPubkeys(cachedParticipants);
      setParticipants(cachedParticipation);
      
      // Check user participation from cache
      if (publicKey) {
        setIsParticipating(cachedParticipants.includes(publicKey));
      }
      return;
    }

    setIsLoadingParticipants(true);

    try {
      const [eventParticipants, participationData] = await Promise.all([
        fetchWithTimeout(
          (ndk) => fetchEventParticipants(ndk, eventId, teamAIdentifier),
          10000
        ),
        fetchWithTimeout(
          (ndk) => fetchEventParticipation(ndk, eventId, teamAIdentifier, eventDetails.date),
          10000
        )
      ]);

      // Cache results
      teamEventsCache.set(participantsCacheKey, eventParticipants || [], CACHE_TTL.PARTICIPANTS);
      teamEventsCache.set(participationCacheKey, participationData || [], CACHE_TTL.PARTICIPATION);

      // Set state
      setParticipantPubkeys(eventParticipants || []);
      setParticipants(participationData || []);

      // Check user participation
      if (publicKey && eventParticipants?.length > 0) {
        const userIsParticipating = await fetchWithTimeout(
          (ndk) => isUserParticipating(ndk, eventId, teamAIdentifier, publicKey),
          8000
        );
        setIsParticipating(userIsParticipating);
      } else {
        setIsParticipating(false);
      }

    } catch (error) {
      console.error('Error loading participants:', error);
      // Set empty arrays but don't show error - participants might just be loading
      setParticipantPubkeys([]);
      setParticipants([]);
      setIsParticipating(false);
    } finally {
      setIsLoadingParticipants(false);
    }
  }, [ndk, eventId, teamAIdentifier, publicKey, fetchWithTimeout]);

  const loadActivities = useCallback(async (eventDetails: TeamEventDetails, participantPubkeys: string[]) => {
    if (!ndk || participantPubkeys.length === 0) return;

    const cacheKey = CACHE_KEYS.EVENT_ACTIVITIES(teamAIdentifier, eventId);
    
    // Check cache first
    const cachedActivities = teamEventsCache.get<any[]>(cacheKey);
    if (cachedActivities) {
      setActivities(cachedActivities);
      return;
    }

    setIsLoadingActivities(true);

    try {
      const eventActivities = await fetchEventActivities(
        ndk, 
        eventDetails.id, 
        teamAIdentifier, 
        participantPubkeys, 
        eventDetails.date,
        eventDetails.endTime ? eventDetails.date : undefined
      );

      const formattedActivities = eventActivities.map(activity => ({
        ...activity,
        kind: activity.kind,
        content: activity.content,
        created_at: activity.created_at,
        pubkey: activity.pubkey,
        tags: activity.tags,
        author: {
          pubkey: activity.pubkey
        }
      }));

      // Cache and set activities
      teamEventsCache.set(cacheKey, formattedActivities, CACHE_TTL.ACTIVITIES);
      setActivities(formattedActivities);

    } catch (error) {
      console.error('Error loading activities:', error);
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [ndk, teamAIdentifier, eventId]);

  // Main loading effect - progressive loading
  useEffect(() => {
    if (!eventId || !teamAIdentifier) {
      setLoadingState('error');
      setLoadingStatus('Missing event ID or team identifier');
      return;
    }

    let isMounted = true;

    const progressiveLoad = async () => {
      // Step 1: Load event details (show page immediately)
      const eventDetails = await loadEventDetails();
      
      if (!isMounted || !eventDetails) return;

      // Step 2: Load participants in background
      loadParticipants(eventDetails);

      // Step 3: Load activities after participants (will auto-trigger when participants load)
    };

    progressiveLoad();

    return () => {
      isMounted = false;
    };
  }, [eventId, teamAIdentifier, loadEventDetails, loadParticipants]);

  // Load activities when participants change
  useEffect(() => {
    if (event && participantPubkeys.length > 0) {
      loadActivities(event, participantPubkeys);
    }
  }, [event, participantPubkeys, loadActivities]);

  // Check participation state when user comes back to tab (handles tab switching)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && publicKey && eventId && teamAIdentifier && event) {
        // User returned to tab - refresh participation state
        try {
          const currentParticipation = await isUserParticipating(ndk, eventId, teamAIdentifier, publicKey);
          if (currentParticipation !== isParticipating) {
            setIsParticipating(currentParticipation);
            
            // Also refresh the participant list
            await loadParticipants(event);
          }
        } catch (error) {
          console.error('Error checking participation on tab focus:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [publicKey, eventId, teamAIdentifier, event, isParticipating, ndk, loadParticipants]);

  // Remove timeout - it's causing false timeouts when the event actually loads
  // The event is loading properly, just slowly

  const handleJoinEvent = async () => {
    if (!ndk || !publicKey || !event) {
      toast.error('Unable to join event');
      return;
    }

    setIsJoining(true);
    try {
      const result = await joinTeamEvent(ndk, eventId!, teamAIdentifier, captainPubkey!);
      if (result) {
        // Immediately update UI state
        setIsParticipating(true);
        toast.success('Successfully joined the event!');
        
        // Clear all related cache
        teamEventsCache.delete(CACHE_KEYS.EVENT_PARTICIPANTS(teamAIdentifier, eventId!));
        teamEventsCache.delete(CACHE_KEYS.EVENT_PARTICIPATION(teamAIdentifier, eventId!));
        teamEventsCache.delete(CACHE_KEYS.EVENT_ACTIVITIES(teamAIdentifier, eventId!));
        
        // Reload participants and activities with fresh data
        setTimeout(async () => {
          if (event) {
            await loadParticipants(event);
          }
        }, 500); // Small delay to let the event propagate
      } else {
        toast.error('Failed to join event');
      }
    } catch (error) {
      console.error('Error joining event:', error);
      toast.error('Failed to join event');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveEvent = async () => {
    if (!ndk || !publicKey || !event) {
      toast.error('Unable to leave event');
      return;
    }

    setIsJoining(true);
    try {
      const success = await leaveTeamEvent(ndk, eventId!, teamAIdentifier);
      if (success) {
        // Immediately update UI state
        setIsParticipating(false);
        toast.success('Left the event');
        
        // Clear all related cache
        teamEventsCache.delete(CACHE_KEYS.EVENT_PARTICIPANTS(teamAIdentifier, eventId!));
        teamEventsCache.delete(CACHE_KEYS.EVENT_PARTICIPATION(teamAIdentifier, eventId!));
        teamEventsCache.delete(CACHE_KEYS.EVENT_ACTIVITIES(teamAIdentifier, eventId!));
        
        // Reload participants and activities with fresh data
        setTimeout(async () => {
          if (event) {
            await loadParticipants(event);
          }
        }, 500); // Small delay to let the event propagate
      } else {
        toast.error('Failed to leave event');
      }
    } catch (error) {
      console.error('Error leaving event:', error);
      toast.error('Failed to leave event');
    } finally {
      setIsJoining(false);
    }
  };

  const getEventStatus = (): string => {
    if (!event) return 'unknown';
    
    const now = new Date();
    
    // If event has start/end times, use them for precise timing
    if (event.startTime && event.endTime) {
      const eventStart = new Date(event.date + 'T' + event.startTime);
      const eventEnd = new Date(event.date + 'T' + event.endTime);
      
      if (now > eventEnd) {
        return 'completed';
      } else if (now >= eventStart && now <= eventEnd) {
        return 'active';
      } else {
        return 'upcoming';
      }
    }
    
    // For all-day events, use more precise timing
    const eventStart = new Date(event.date);
    eventStart.setHours(0, 0, 0, 0);
    const eventEnd = new Date(event.date);
    eventEnd.setHours(23, 59, 59, 999);
    
    if (now > eventEnd) {
      return 'completed';
    } else if (now >= eventStart && now <= eventEnd) {
      return 'active';
    } else {
      return 'upcoming';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-text-muted"></div>
            <span className="text-sm text-text-muted">Completed</span>
          </div>
        );
      case 'active':
        return (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
            <span className="text-sm text-success font-medium">Live Now</span>
          </div>
        );
      case 'upcoming':
        return (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-text-secondary"></div>
            <span className="text-sm text-text-secondary">Upcoming</span>
          </div>
        );
      default:
        return null;
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (activity: string, pace: number): string => {
    if (activity === 'cycle') {
      return `${pace.toFixed(1)} km/h`;
    }
    // For run/walk, pace is in min/km
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
  };

  const sortedParticipants = useMemo(() => {
    // Combine participants and their completion data
    const allParticipants = participantPubkeys.map(pubkey => {
      const participation = participants.find(p => p.pubkey === pubkey);
      return {
        pubkey,
        distance: participation?.distance || 0,
        duration: participation?.duration || 0,
        pace: participation?.pace || 0,
        completed: participation ? participation.distance >= (event?.distance || 0) * 0.8 : false,
        isCurrentUser: pubkey === publicKey
      };
    });

    // Sort by completion status, then by distance/time
    return allParticipants.sort((a, b) => {
      // Completed participants first
      if (a.completed && !b.completed) return -1;
      if (!a.completed && b.completed) return 1;
      
      // Among completed participants, sort by time (fastest first)
      if (a.completed && b.completed) {
        return a.duration - b.duration;
      }
      
      // Among non-completed participants, sort by distance (highest first)
      return b.distance - a.distance;
    });
  }, [participantPubkeys, participants, event?.distance, publicKey]);

  const renderLeaderboard = () => {

    if (sortedParticipants.length === 0) {
      return (
        <div className="text-center py-12 bg-black rounded-lg border border-white">
          <p className="text-white">No participants yet</p>
          <p className="text-sm text-gray-300 mt-2">Be the first to join!</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-white/20">
        {sortedParticipants.map((participant, index) => {
            const rank = index + 1;
            
            return (
              <div
                key={participant.pubkey}
                className={`flex items-center justify-between p-4 ${
                  participant.isCurrentUser ? 'bg-white/10 border-l-4 border-white' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  {/* League-Style Rank Badge */}
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                    ${rank === 1 ? 'bg-yellow-500 text-black' : ''}
                    ${rank === 2 ? 'bg-gray-400 text-black' : ''}
                    ${rank === 3 ? 'bg-orange-600 text-white' : ''}
                    ${rank > 3 ? 'bg-black text-white border border-white' : ''}
                  `}>
                    {rank}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <DisplayName pubkey={participant.pubkey} />
                      {participant.isCurrentUser && (
                        <span className="px-2 py-1 bg-white text-black text-xs rounded-full font-bold">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-300">
                      {participant.completed ? (
                        <>
                          Completed • {formatTime(participant.duration)}
                          {participant.pace > 0 && (
                            <span className="ml-2">
                              {formatPace(event?.activity || 'run', participant.pace)}
                            </span>
                          )}
                        </>
                      ) : (
                        'Joined event'
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="text-right">
                  <div className={`font-semibold ${participant.completed ? 'text-white' : 'text-gray-300'}`}>
                    {participant.distance.toFixed(1)} km
                  </div>
                  <div className="text-xs text-gray-400">
                    Rank #{rank}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    );
  };

  // Enhanced loading states with proper error handling
  if (loadingState === 'loading' || isLoadingEvent) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary mx-auto mb-4"></div>
            <p className="text-text-secondary mb-4">Loading event details...</p>
            <div className="bg-bg-secondary rounded-lg p-4 mb-4 border border-border-secondary">
              <p className="text-sm text-text-secondary">{loadingStatus}</p>
            </div>
            <button
              onClick={() => navigate(`/teams/${captainPubkey}/${teamUUID}`)}
              className="mt-4 px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg border border-border-secondary transition-colors"
            >
              ← Back to Team
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingState === 'timeout') {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8">
            <div className="text-warning text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">Request Timed Out</h2>
            <p className="text-text-secondary mb-4">Loading took too long. This might be due to slow relay connections.</p>
            <div className="bg-bg-secondary rounded-lg p-4 mb-4 border border-border-secondary">
              <p className="text-sm text-text-muted">{loadingStatus}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-text-inverse rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate(`/teams/${captainPubkey}/${teamUUID}`)}
                className="px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg border border-border-secondary transition-colors"
              >
                ← Back to Team
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadingState === 'error') {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8">
            <div className="text-error text-4xl mb-4">❌</div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">Loading Error</h2>
            <p className="text-text-secondary mb-4">Unable to load event details</p>
            <div className="bg-bg-secondary rounded-lg p-4 mb-4 border border-border-secondary">
              <p className="text-sm text-text-muted">{loadingStatus}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-text-inverse rounded-lg transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => navigate(`/teams/${captainPubkey}/${teamUUID}`)}
                className="px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg border border-border-secondary transition-colors"
              >
                ← Back to Team
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event && loadingState === 'success') {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8">
            <div className="text-error text-4xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">Event Not Found</h2>
            <p className="text-text-secondary mb-4">The requested event could not be found</p>
            <button
              onClick={() => navigate(`/teams/${captainPubkey}/${teamUUID}`)}
              className="mt-4 px-4 py-2 bg-primary hover:bg-primary-hover text-text-inverse rounded-lg transition-colors"
            >
              ← Back to Team
            </button>
          </div>
        </div>
      </div>
    );
  }

  
  const status = getEventStatus();

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => {
              // Clear any event-specific cache before navigating
              teamEventsCache.delete(CACHE_KEYS.EVENT_DETAILS(teamAIdentifier, eventId!));
              teamEventsCache.delete(CACHE_KEYS.EVENT_PARTICIPANTS(teamAIdentifier, eventId!));
              teamEventsCache.delete(CACHE_KEYS.EVENT_PARTICIPATION(teamAIdentifier, eventId!));
              teamEventsCache.delete(CACHE_KEYS.EVENT_ACTIVITIES(teamAIdentifier, eventId!));
              
              navigate(`/teams/${captainPubkey}/${teamUUID}`, { replace: true });
            }}
            className="flex items-center text-white hover:text-gray-300 transition-colors mb-4"
          >
            <span className="mr-2">←</span>
            Back to Team
          </button>
        </div>

        {/* Event Details */}
        <div className="bg-black rounded-lg border border-white p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">{event.name}</h1>
              <p className="text-gray-300 mb-2">
                {event.distance}km {event.activity} • {new Date(event.date).toLocaleDateString()}
                {event.startTime && ` • ${event.startTime}`}
                {event.endTime && ` - ${event.endTime}`}
              </p>
              {event.description && (
                <p className="text-white text-sm">
                  {event.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(status)}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Show join/leave button for all logged-in users (including captains) */}
            {publicKey && (
              <>
                {isParticipating ? (
                  <button
                    onClick={handleLeaveEvent}
                    disabled={isJoining}
                    className="px-4 py-2 bg-black hover:bg-gray-900 text-white border border-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isJoining ? 'Leaving...' : 'Leave Event'}
                  </button>
                ) : (
                  <button
                    onClick={handleJoinEvent}
                    disabled={isJoining || status === 'completed'}
                    className="px-4 py-2 bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 border-2 border-white focus:outline-none focus:ring-0"
                  >
                    {isJoining ? 'Joining...' : 'Join Event'}
                  </button>
                )}
              </>
            )}
            
            {/* Show edit button for captains */}
            {isCaptain && (
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 bg-black hover:bg-white hover:text-black text-white text-sm rounded-lg transition-colors border border-white focus:outline-none focus:ring-0"
              >
                Edit Event
              </button>
            )}
            
            {/* Show message if user is not logged in */}
            {!publicKey && (
              <p className="text-sm text-gray-300">Sign in to join this event</p>
            )}
          </div>
        </div>

        {/* Participants Section */}
        <div className="bg-black rounded-lg border border-white overflow-hidden focus:outline-none focus:ring-0">
          <div className="p-4 border-b border-white bg-black focus:outline-none focus:ring-0">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Event Leaderboard</h2>
              <span className="text-sm text-gray-300">
                {isLoadingParticipants ? 'Loading...' : `${participantPubkeys.length} participant${participantPubkeys.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
          
          {isLoadingParticipants ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white text-sm">Loading participants...</p>
            </div>
          ) : (
            renderLeaderboard()
          )}
        </div>

        {/* Activity Feed Section */}
        <div className="bg-black rounded-lg border border-white overflow-hidden mt-6 focus:outline-none focus:ring-0">
          <div className="p-4 border-b border-white bg-black focus:outline-none focus:ring-0">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Event Activities</h2>
              <span className="text-sm text-gray-300">
                {activities.length} workout{activities.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          <div className="p-4">
            {isLoadingActivities ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-white">Loading activities...</p>
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-white mb-2">No activities yet</p>
                <p className="text-sm text-gray-300">
                  Participant workouts during the event will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={activity.id || index} className="bg-black rounded-lg border border-white">
                    <Post 
                      post={activity} 
                      handleZap={() => {}} 
                      wallet={null} 
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditModal && (
        <EditEventModal
          event={event}
          onClose={() => setShowEditModal(false)}
          onEventUpdated={() => {
            setShowEditModal(false);
            // Reload event data
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

export default TeamEventDetailPage;