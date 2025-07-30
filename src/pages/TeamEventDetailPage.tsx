import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNostr } from '../hooks/useNostr';
import { 
  fetchTeamEvents, 
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
  const [isLoading, setIsLoading] = useState(true);
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
  const loadEventActivities = async (eventDetails: TeamEventDetails, participantPubkeys: string[]) => {
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
  };

  // Enhanced event loading with proper timeout and cancellation
  useEffect(() => {
    if (!eventId || !teamAIdentifier) {
      setLoadingState('error');
      setLoadingStatus('Missing event ID or team identifier');
      return;
    }

    let isMounted = true;
    
    const loadEvent = async () => {
      try {
        setLoadingState('loading');
        setLoadingStatus('Checking NDK connection...');
        
        // Ensure NDK is ready with timeout
        if (!ndkStatus?.isConnected) {
          setLoadingStatus('Connecting to Nostr relays...');
          const connected = await ensureConnection(15000);
          if (!connected) {
            if (isMounted) {
              setLoadingState('error');
              setLoadingStatus('Failed to connect to Nostr relays');
              toast.error('Unable to connect to Nostr network');
            }
            return;
          }
        }

        if (!isMounted) return;
        setLoadingStatus('Fetching team events...');
        
        // Use enhanced fetch with automatic timeout and cancellation
        const teamEvents = await fetchWithTimeout(
          (ndk) => fetchTeamEvents(ndk, teamAIdentifier),
          12000 // 12 second timeout
        );

        if (!isMounted) return;
        setLoadingStatus(`Found ${teamEvents.length} events, searching for ${eventId}...`);
        
        const foundEvent = teamEvents.find(e => e.id === eventId);
        if (!foundEvent) {
          if (isMounted) {
            setLoadingState('error');
            setLoadingStatus('Event not found');
            toast.error('Event not found');
            setTimeout(() => navigate(`/teams/${captainPubkey}/${teamUUID}`), 2000);
          }
          return;
        }

        if (!isMounted) return;
        setEvent(foundEvent);
        setLoadingStatus('Loading participants...');

        // Load participants and participation data with timeout
        const [eventParticipants, participationData] = await Promise.all([
          fetchWithTimeout(
            (ndk) => fetchEventParticipants(ndk, eventId, teamAIdentifier),
            10000
          ),
          fetchWithTimeout(
            (ndk) => fetchEventParticipation(ndk, eventId, teamAIdentifier, foundEvent.date),
            10000
          )
        ]);

        if (!isMounted) return;
        setParticipantPubkeys(eventParticipants);
        setParticipants(participationData);

        // Check if current user is participating
        if (publicKey) {
          setLoadingStatus('Checking participation...');
          const userIsParticipating = await fetchWithTimeout(
            (ndk) => isUserParticipating(ndk, eventId, teamAIdentifier, publicKey),
            8000
          );
          if (isMounted) {
            setIsParticipating(userIsParticipating);
          }
        }

        // Load event activities if we have participants
        if (eventParticipants.length > 0) {
          setLoadingStatus('Loading activities...');
          await loadEventActivities(foundEvent, eventParticipants);
        }
        
        if (isMounted) {
          setLoadingState('success');
          setLoadingStatus('Complete');
        }

      } catch (error) {
        console.error('Error loading event:', error);
        
        if (!isMounted) return;
        
        if (error.message === 'Request cancelled') {
          setLoadingState('cancelled');
          setLoadingStatus('Request cancelled');
        } else if (error.message.includes('timeout')) {
          setLoadingState('timeout');
          setLoadingStatus('Request timed out');
          toast.error('Loading timed out. Please try again.');
        } else {
          setLoadingState('error');
          setLoadingStatus(`Error: ${error.message}`);
          toast.error('Failed to load event details');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadEvent();
    
    return () => {
      isMounted = false;
    };
  }, [eventId, teamAIdentifier, fetchWithTimeout, ensureConnection, ndkStatus, publicKey, captainPubkey, teamUUID, navigate]);

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
        setIsParticipating(true);
        toast.success('Successfully joined the event!');
        
        // Refresh participant list
        const updatedParticipants = await fetchEventParticipants(ndk, eventId!, teamAIdentifier);
        setParticipantPubkeys(updatedParticipants);
        
        // Refresh activities if event details are available
        if (event && updatedParticipants.length > 0) {
          await loadEventActivities(event, updatedParticipants);
        }
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
        setIsParticipating(false);
        toast.success('Left the event');
        
        // Refresh participant list
        const updatedParticipants = await fetchEventParticipants(ndk, eventId!, teamAIdentifier);
        setParticipantPubkeys(updatedParticipants);
        
        // Refresh activities if event details are available
        if (event && updatedParticipants.length > 0) {
          await loadEventActivities(event, updatedParticipants);
        }
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

  const renderLeaderboard = () => {
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
    const sortedParticipants = allParticipants.sort((a, b) => {
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

    if (sortedParticipants.length === 0) {
      return (
        <div className="text-center py-12 bg-gray-800/50 rounded-lg">
          <p className="text-gray-400">No participants yet</p>
          <p className="text-sm text-gray-500 mt-2">Be the first to join!</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-gray-700">
        {sortedParticipants.map((participant, index) => {
            const rank = index + 1;
            
            return (
              <div
                key={participant.pubkey}
                className={`flex items-center justify-between p-4 ${
                  participant.isCurrentUser ? 'bg-white/5 border-l-4 border-white' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  {/* League-Style Rank Badge */}
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                    ${rank === 1 ? 'bg-yellow-500 text-black' : ''}
                    ${rank === 2 ? 'bg-gray-400 text-black' : ''}
                    ${rank === 3 ? 'bg-orange-600 text-white' : ''}
                    ${rank > 3 ? 'bg-gray-800 text-gray-400 border border-gray-600' : ''}
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
                    <div className="text-xs text-gray-400">
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
                  <div className={`font-semibold ${participant.completed ? 'text-white' : 'text-gray-400'}`}>
                    {participant.distance.toFixed(1)} km
                  </div>
                  <div className="text-xs text-gray-500">
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
  if (loadingState === 'loading' || isLoading) {
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
            onClick={() => navigate(`/teams/${captainPubkey}/${teamUUID}`)}
            className="flex items-center text-gray-400 hover:text-white transition-colors mb-4"
          >
            <span className="mr-2">←</span>
            Back to Team
          </button>
        </div>

        {/* Event Details */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">{event.name}</h1>
              <p className="text-gray-400 mb-2">
                {event.distance}km {event.activity} • {new Date(event.date).toLocaleDateString()}
                {event.startTime && ` • ${event.startTime}`}
                {event.endTime && ` - ${event.endTime}`}
              </p>
              {event.description && (
                <p className="text-gray-300 text-sm">
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
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isJoining ? 'Leaving...' : 'Leave Event'}
                  </button>
                ) : (
                  <button
                    onClick={handleJoinEvent}
                    disabled={isJoining || status === 'completed'}
                    className="px-4 py-2 bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 border-2 border-black focus:outline-none focus:ring-0"
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
                className="px-4 py-2 bg-gray-800 hover:bg-white hover:text-black text-white text-sm rounded-lg transition-colors border border-gray-700 hover:border-black focus:outline-none focus:ring-0"
              >
                Edit Event
              </button>
            )}
            
            {/* Show message if user is not logged in */}
            {!publicKey && (
              <p className="text-sm text-gray-400">Sign in to join this event</p>
            )}
          </div>
        </div>

        {/* Participants Section */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden focus:outline-none focus:ring-0" style={{backgroundColor: '#111827 !important', background: '#111827 !important'}}>
          <div className="p-4 border-b border-gray-700 bg-gray-800 focus:outline-none focus:ring-0 focus:bg-gray-800" style={{backgroundColor: '#1f2937 !important', background: '#1f2937 !important'}}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Event Leaderboard</h2>
              <span className="text-sm text-gray-400">
                {participantPubkeys.length} participant{participantPubkeys.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          {renderLeaderboard()}
        </div>

        {/* Activity Feed Section */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden mt-6 focus:outline-none focus:ring-0" style={{backgroundColor: '#111827 !important', background: '#111827 !important'}}>
          <div className="p-4 border-b border-gray-700 bg-gray-800 focus:outline-none focus:ring-0 focus:bg-gray-800" style={{backgroundColor: '#1f2937 !important', background: '#1f2937 !important'}}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Event Activities</h2>
              <span className="text-sm text-gray-400">
                {activities.length} workout{activities.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          <div className="p-4">
            {isLoadingActivities ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-gray-400">Loading activities...</p>
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-2">No activities yet</p>
                <p className="text-sm text-gray-500">
                  Participant workouts during the event will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity, index) => (
                  <div key={activity.id || index} className="bg-gray-800 rounded-lg border border-gray-700">
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