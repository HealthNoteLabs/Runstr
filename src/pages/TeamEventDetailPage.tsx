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
import CaptainNotificationsModal from '../components/modals/CaptainNotificationsModal';
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

  // Early return if required params are missing to prevent crashes
  if (!captainPubkey || !teamUUID || !eventId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Invalid Event URL</h1>
          <p className="text-gray-400 mb-4">Missing required event parameters</p>
          <button 
            onClick={() => navigate('/teams')}
            className="px-4 py-2 bg-white text-black rounded-lg"
          >
            Back to Teams
          </button>
        </div>
      </div>
    );
  }

  // Initialize with skeleton event to prevent black screen
  const [event, setEvent] = useState<TeamEventDetails | null>(() => {
    if (!eventId || !captainPubkey || !teamUUID) return null;
    
    return {
      id: eventId,
      name: 'Loading Event...',
      description: '',
      date: new Date().toISOString().split('T')[0],
      startTime: null,
      endTime: null,
      distance: 0,
      activity: 'run',
      teamAIdentifier: `33404:${captainPubkey}:${teamUUID}`,
      captainPubkey: captainPubkey,
      isLoading: true
    };
  });
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [loadingState, setLoadingState] = useState<'loading' | 'success' | 'error' | 'timeout' | 'cancelled'>('loading');
  const [joinDebugInfo, setJoinDebugInfo] = useState<string[]>([]);
  
  // Construct team identifier from URL params (needed for hooks) - MUST be before skeleton
  const teamAIdentifier = `33404:${captainPubkey}:${teamUUID}`;
  
  // LEAGUE PATTERN: Create skeleton event structure for immediate display
  const skeletonEvent = useMemo(() => {
    if (!eventId || !captainPubkey || !teamUUID) return null;
    
    return {
      id: eventId,
      name: 'Loading Event...',
      description: '',
      date: new Date().toISOString().split('T')[0],
      startTime: null,
      endTime: null,
      distance: 0,
      activity: 'run',
      teamAIdentifier: teamAIdentifier,
      captainPubkey: captainPubkey,
      isLoading: true
    };
  }, [eventId, captainPubkey, teamUUID, teamAIdentifier]);

  // Check if current user is team captain
  const isCaptain = publicKey === captainPubkey;
  
  // Use new simplified participation system - only when we have basic event data
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
  } = useEventParticipants(
    eventId, 
    captainPubkey, 
    event?.name || 'Event', // Provide fallback name
    teamAIdentifier
  );

  // Use new event leaderboard system - only when we have participants and event date
  const {
    leaderboard,
    workoutActivities,
    stats: leaderboardStats,
    isLoading: isLoadingActivities,
    error: leaderboardError,
    refresh: refreshLeaderboard
  } = useEventLeaderboard(
    participants || [], // Ensure array
    event?.date || new Date().toISOString().split('T')[0], // Provide fallback date
    event?.endTime || null,
    'all' // Show all activity types
  );

  // Simple effect to set loading complete since we start with skeleton
  useEffect(() => {
    if (event && event.isLoading) {
      console.log('[TeamEventDetailPage] Event initialized with skeleton, setting ready state');
      setIsLoadingEvent(false);
      setLoadingState('success');
      setLoadingStatus('Event ready');
    }
  }, [event]);


  // Remove timeout - it's causing false timeouts when the event actually loads
  // The event is loading properly, just slowly

  const handleJoinEvent = async () => {
    console.log('🔵 [TeamEventDetailPage] JOIN BUTTON CLICKED');
    
    // Clear previous debug info
    setJoinDebugInfo(['Join button clicked...']);
    
    const debugState = {
      publicKey: publicKey ? `${publicKey.slice(0, 8)}...` : null,
      eventId,
      captainPubkey: captainPubkey ? `${captainPubkey.slice(0, 8)}...` : null,
      teamUUID,
      eventName: event?.name,
      hasEvent: !!event,
      isJoining,
      isUserParticipating,
      isUserParticipatingLocally,
      ndkReady,
      participantCount
    };
    
    console.log('🔵 [TeamEventDetailPage] Current state:', debugState);
    setJoinDebugInfo(prev => [...prev, `State: ${JSON.stringify(debugState, null, 2)}`]);

    if (!publicKey) {
      console.log('🔴 [TeamEventDetailPage] No publicKey, aborting');
      setJoinDebugInfo(prev => [...prev, '❌ ERROR: Not signed in']);
      toast.error('Please sign in to join events');
      return;
    }

    if (!event) {
      console.log('🔴 [TeamEventDetailPage] No event data, aborting');
      setJoinDebugInfo(prev => [...prev, '❌ ERROR: Event data unavailable']);
      toast.error('Event information unavailable');
      return;
    }

    try {
      console.log('🟡 [TeamEventDetailPage] Calling joinEvent()...');
      setJoinDebugInfo(prev => [...prev, '🟡 Calling joinEvent()...']);
      
      const result = await joinEvent();
      
      console.log('🟢 [TeamEventDetailPage] joinEvent() returned:', result);
      
      if (result === 'already-joined') {
        setJoinDebugInfo(prev => [...prev, '⚠️ Already joined this event']);
        toast.info('You are already participating in this event');
      } else if (result && result.startsWith('success|')) {
        const steps = result.split('|').slice(1);
        setJoinDebugInfo(prev => [...prev, ...steps]);
        toast.success('Successfully joined the event! 🎉');
      } else {
        setJoinDebugInfo(prev => [...prev, `✅ joinEvent returned: ${result}`]);
        toast.success('Successfully joined the event! 🎉');
      }
      
      // Clear debug info after success
      setTimeout(() => setJoinDebugInfo([]), 10000);
    } catch (error) {
      console.error('🔴 [TeamEventDetailPage] Error in handleJoinEvent:', error);
      console.error('🔴 [TeamEventDetailPage] Error stack:', error.stack);
      
      setJoinDebugInfo(prev => [...prev, `❌ ERROR: ${error.message}`]);
      if (error.stack) {
        setJoinDebugInfo(prev => [...prev, `Stack: ${error.stack}`]);
      }
      
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
            <span className="text-sm text-white">✓</span>
            <span className="text-sm text-white/60">Completed</span>
          </div>
        );
      case 'active':
        return (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
            <span className="text-sm text-white font-medium">Live Now</span>
          </div>
        );
      case 'upcoming':
        return (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full border border-white/60"></div>
            <span className="text-sm text-white/60">Upcoming</span>
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
        <div className="text-center py-12 bg-black border border-white/20">
          <p className="text-white">No participants yet</p>
          <p className="text-sm text-white/60 mt-2">Be the first to join!</p>
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
                  participant.isCurrentUser ? 'bg-white/10 border-l-2 border-white' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  {/* Minimalist Rank Badge */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-white text-black">
                    {rank}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <DisplayName pubkey={participant.pubkey} />
                      {participant.isCurrentUser && (
                        <span className="px-2 py-1 bg-white text-black text-xs font-bold">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/60">
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
                  <div className={`font-semibold ${participant.completed ? 'text-white' : 'text-white/60'}`}>
                    {participant.distance.toFixed(1)} km
                  </div>
                  <div className="text-xs text-white/60">
                    Rank #{rank}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    );
  };

  // Show loading ONLY if we have no event data AND are actively loading for the first time
  const shouldShowLoading = isLoadingEvent && !event && loadingState === 'loading';
  
  if (shouldShowLoading) {
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

  // Only show critical error if we can't show any UI at all
  const hasCriticalError = !event && loadingState === 'error' && !isLoadingEvent;
  
  if (hasCriticalError) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="text-red-400 mb-4">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Event Not Available</h2>
              <p className="text-gray-400 mb-4">{loadingStatus}</p>
              {!ndkReady && (
                <p className="text-yellow-400 text-sm mb-4">
                  ⚠️ Still connecting to network...
                </p>
              )}
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-white text-black rounded-lg"
                >
                  Retry
                </button>
                <button 
                  onClick={() => navigate(`/teams/${captainPubkey}/${teamUUID}`)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg"
                >
                  ← Back to Team
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="max-w-4xl mx-auto p-4">

        {/* Event Details */}
        <div className="bg-black border border-white/20 p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {event?.name || 'Loading Event...'}
                {event?.isLoading && (
                  <span className="ml-2 text-sm text-white/60">(loading details...)</span>
                )}
              </h1>
              <p className="text-white/80 mb-2">
                {event?.distance || 0}km {event?.activity || 'run'} • {new Date(event?.date || Date.now()).toLocaleDateString()}
                {event?.startTime && ` • ${event.startTime}`}
                {event?.endTime && ` - ${event.endTime}`}
              </p>
              {event?.description && (
                <p className="text-white/80 text-sm">
                  {event.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {event && getStatusBadge(status)}
              {!ndkReady && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                  <span className="text-xs text-white/60">Connecting...</span>
                </div>
              )}
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
                    className="px-4 py-2 bg-black text-white border border-white/40 hover:border-white transition-colors disabled:opacity-50"
                  >
                    {isLeaving ? 'Leaving...' : 'Leave Event'}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      console.log('🔵 [TeamEventDetailPage] JOIN BUTTON PHYSICALLY CLICKED');
                      handleJoinEvent();
                    }}
                    disabled={isJoining || isLeaving || status === 'completed'}
                    className="px-4 py-2 bg-white text-black font-semibold border border-white hover:bg-white/90 transition-colors disabled:opacity-50"
                  >
                    {isJoining ? 'Joining...' : 'Join Event'}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-white/60">Sign in to join this event</p>
            )}
            
            {/* Show captain buttons */}
            {isCaptain && (
              <>
                <button
                  onClick={() => setShowNotificationsModal(true)}
                  className="px-4 py-2 bg-black text-white text-sm border border-white/40 hover:border-white transition-colors"
                  title="View join requests"
                >
                  Join Requests
                </button>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-4 py-2 bg-black text-white text-sm border border-white/40 hover:border-white transition-colors"
                >
                  Edit Event
                </button>
              </>
            )}
          </div>
          
          {/* Debug Info Panel - Only shows when there's debug info */}
          {joinDebugInfo.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-500/50 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-yellow-400 font-semibold">Join Debug Info:</h3>
                <button
                  onClick={() => setJoinDebugInfo([])}
                  className="text-yellow-400 hover:text-yellow-300 text-sm"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1">
                {joinDebugInfo.map((info, index) => (
                  <pre key={index} className="text-xs text-yellow-200 whitespace-pre-wrap break-words">
                    {info}
                  </pre>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Participants Section */}
        <div className="bg-black border border-white/20 overflow-hidden">
          <div className="p-4 border-b border-white/20 bg-black">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Event Leaderboard</h2>
              <div className="flex items-center gap-2">
                {participantsError && (
                  <span className="text-xs text-white/60" title={participantsError}>⚠️</span>
                )}
                <span className="text-sm text-white/60">
                  {isLoadingParticipants ? 'Loading...' : `${participantCount} participant${participantCount !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
            {participantsError && (
              <p className="text-xs text-white/60 mt-1">
                Participant data may be limited - {participantsDataSource} only
              </p>
            )}
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
        <div className="bg-black border border-white/20 overflow-hidden mt-6">
          <div className="p-4 border-b border-white/20 bg-black">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Event Activities</h2>
              <div className="flex items-center gap-2">
                {leaderboardError && (
                  <span className="text-xs text-white/60" title={leaderboardError}>⚠️</span>
                )}
                <span className="text-sm text-white/60">
                  {workoutActivities.length} workout{workoutActivities.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            {leaderboardError && (
              <p className="text-xs text-white/60 mt-1">
                Activity feed may be limited - network connection issues
              </p>
            )}
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
                    <div key={activity.id || index} className="bg-black border border-white/20">
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

      {showNotificationsModal && (
        <CaptainNotificationsModal
          isOpen={showNotificationsModal}
          onClose={() => setShowNotificationsModal(false)}
          captainPubkey={captainPubkey!}
          eventId={eventId!}
          eventName={event?.name}
          teamUUID={teamUUID!}
        />
      )}
    </div>
  );
};

export default TeamEventDetailPage;