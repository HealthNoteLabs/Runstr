import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNostr } from '../hooks/useNostr';
import { 
  fetchTeamEvents, 
  fetchTeamEventById,
  TeamEventDetails
} from '../services/nostr/NostrTeamsService';
import { useEventParticipants } from '../hooks/useEventParticipants';
import { useEventLeaderboard } from '../hooks/useEventLeaderboard';
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
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [loadingState, setLoadingState] = useState<'loading' | 'success' | 'error' | 'timeout' | 'cancelled'>('loading');
  
  // Use new simplified participation system
  const {
    participants,
    participantCount,
    isUserParticipating,
    isUserParticipatingLocally,
    isLoading: isLoadingParticipants,
    isJoining,
    isLeaving,
    error: participantsError,
    joinEvent,
    leaveEvent,
    refresh: refreshParticipants,
    dataSource: participantsDataSource
  } = useEventParticipants(eventId, captainPubkey, event?.name, teamAIdentifier);

  // Use new event leaderboard system
  const {
    leaderboard,
    workoutActivities,
    stats: leaderboardStats,
    isLoading: isLoadingActivities,
    error: leaderboardError,
    refresh: refreshLeaderboard
  } = useEventLeaderboard(
    participants,
    event?.date,
    event?.endTime,
    'all' // Show all activity types
  );
  
  // Construct team identifier from URL params
  const teamAIdentifier = `33404:${captainPubkey}:${teamUUID}`;

  // Check if current user is team captain
  const isCaptain = publicKey === captainPubkey;

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



  // Main loading effect - load event details only
  useEffect(() => {
    if (!eventId || !teamAIdentifier) {
      setLoadingState('error');
      setLoadingStatus('Missing event ID or team identifier');
      return;
    }

    loadEventDetails();
  }, [eventId, teamAIdentifier, loadEventDetails]);


  // Remove timeout - it's causing false timeouts when the event actually loads
  // The event is loading properly, just slowly

  const handleJoinEvent = async () => {
    if (!publicKey) {
      toast.error('Please sign in to join events');
      return;
    }

    if (!event) {
      toast.error('Event information unavailable');
      return;
    }

    try {
      await joinEvent();
      toast.success('Successfully joined the event! 🎉');
    } catch (error) {
      console.error('Error joining event:', error);
      toast.error(error.message || 'Failed to join event - please try again');
    }
  };

  const handleLeaveEvent = async () => {
    if (!publicKey) {
      toast.error('Please sign in to leave events');
      return;
    }

    if (!event) {
      toast.error('Event information unavailable');
      return;
    }

    try {
      await leaveEvent();
      toast.success('Left the event');
    } catch (error) {
      console.error('Error leaving event:', error);
      toast.error(error.message || 'Failed to leave event - please try again');
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
    if (!event) return [];
    
    // Use leaderboard data if available, otherwise show participants without activity
    const participantMap = new Map();
    
    // Add all participants first
    participants.forEach(participant => {
      participantMap.set(participant.pubkey, {
        pubkey: participant.pubkey,
        distance: 0,
        duration: 0,
        pace: 0,
        completed: false,
        isCurrentUser: participant.pubkey === publicKey,
        workoutCount: 0,
        rank: 0
      });
    });
    
    // Overlay leaderboard data
    leaderboard.forEach(entry => {
      const eventDistance = event?.distance || 0;
      const completed = eventDistance > 0 ? entry.totalDistance >= eventDistance * 0.8 : false;
      
      participantMap.set(entry.pubkey, {
        pubkey: entry.pubkey,
        distance: entry.totalDistance,
        duration: entry.totalDuration,
        pace: entry.averagePace,
        completed,
        isCurrentUser: entry.pubkey === publicKey,
        workoutCount: entry.workoutCount,
        rank: entry.rank
      });
    });

    const allParticipants = Array.from(participantMap.values());

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
  }, [participants, leaderboard, event?.distance, publicKey]);

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
            {publicKey ? (
              <>
                {isUserParticipating || isUserParticipatingLocally ? (
                  <button
                    onClick={handleLeaveEvent}
                    disabled={isJoining || isLeaving}
                    className="px-4 py-2 bg-black hover:bg-gray-900 text-white border border-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isLeaving ? 'Leaving...' : 'Leave Event'}
                  </button>
                ) : (
                  <button
                    onClick={handleJoinEvent}
                    disabled={isJoining || isLeaving || status === 'completed'}
                    className="px-4 py-2 bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 border-2 border-white focus:outline-none focus:ring-0"
                  >
                    {isJoining ? 'Joining...' : 'Join Event'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-300">Sign in to join this event</p>
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
          </div>
        </div>

        {/* Participants Section */}
        <div className="bg-black rounded-lg border border-white overflow-hidden focus:outline-none focus:ring-0">
          <div className="p-4 border-b border-white bg-black focus:outline-none focus:ring-0">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Event Leaderboard</h2>
              <span className="text-sm text-gray-300">
                {isLoadingParticipants ? 'Loading...' : `${participantCount} participant${participantCount !== 1 ? 's' : ''}`}
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
                {workoutActivities.length} workout{workoutActivities.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          <div className="p-4">
            {isLoadingActivities ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-white">Loading activities...</p>
              </div>
            ) : workoutActivities.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-white mb-2">No activities yet</p>
                <p className="text-sm text-gray-300">
                  Participant workouts during the event will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {workoutActivities.map((activity, index) => {
                  // Format activity for Post component
                  const formattedActivity = {
                    ...activity,
                    kind: activity.kind,
                    content: activity.content,
                    created_at: activity.created_at,
                    pubkey: activity.pubkey,
                    tags: activity.tags || [],
                    author: {
                      pubkey: activity.pubkey
                    }
                  };

                  return (
                    <div key={activity.id || index} className="bg-black rounded-lg border border-white">
                      <Post 
                        post={formattedActivity} 
                        handleZap={() => {}} 
                        wallet={null} 
                      />
                    </div>
                  );
                })}
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