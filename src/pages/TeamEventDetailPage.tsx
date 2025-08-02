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
import { useTeamEventActivityFeed } from '../hooks/useTeamEventActivityFeed';
import { DisplayName } from '../components/shared/DisplayName';
import { Post } from '../components/Post';
import EditEventModal from '../components/modals/EditEventModal';
import CaptainNotificationsModal from '../components/modals/CaptainNotificationsModal';
import { teamEventsCache, CACHE_KEYS, CACHE_TTL } from '../utils/teamEventsCache.js';
import { calculateLeaderboardFromFeed, calculateEventStats } from '../utils/teamEventLeaderboard.js';
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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // Tab navigation state (following League's simple pattern)
  const [activeTab, setActiveTab] = useState<'feed' | 'leaderboard' | 'info'>('feed');
  
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

  // Use new unified team event activity feed (following League pattern)
  const {
    feedEvents,
    enhancedFeedEvents,
    isLoading: isLoadingActivityFeed,
    error: activityFeedError,
    refresh: refreshActivityFeed,
    lastUpdated: feedLastUpdated,
    loadingProgress: feedLoadingProgress
  } = useTeamEventActivityFeed(
    participants || [], // Event participants
    event?.date || new Date().toISOString().split('T')[0], // Event date
    event?.startTime || null, // Event start time
    event?.endTime || null, // Event end time
    event?.activity || 'run' // Event activity type
  );
  
  // Keep existing leaderboard for the leaderboard tab
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

  // Fetch actual event data
  useEffect(() => {
    const fetchEventData = async () => {
      if (!eventId || !captainPubkey || !teamUUID || !ndk || !ndkReady) {
        return;
      }

      try {
        console.log('[TeamEventDetailPage] Fetching event data for:', eventId);
        setLoadingStatus('Loading event details...');
        
        // Fix: Construct teamAIdentifier properly before calling fetchTeamEventById
        const teamAIdentifier = `33404:${captainPubkey}:${teamUUID}`;
        const eventData = await fetchTeamEventById(ndk, teamAIdentifier, eventId);
        
        if (eventData) {
          console.log('[TeamEventDetailPage] Event data loaded:', eventData);
          setEvent({
            ...eventData,
            isLoading: false
          });
          setLoadingState('success');
          setLoadingStatus('Event loaded');
        } else {
          console.warn('[TeamEventDetailPage] No event data found');
          setLoadingState('error');
          setLoadingStatus('Event not found');
        }
      } catch (error) {
        console.error('[TeamEventDetailPage] Error fetching event:', error);
        setLoadingState('error');
        setLoadingStatus('Failed to load event');
      } finally {
        setIsLoadingEvent(false);
      }
    };

    fetchEventData();
  }, [eventId, captainPubkey, teamUUID, ndk, ndkReady]);

  // Fallback effect to set loading complete for skeleton if real data fetch fails
  useEffect(() => {
    if (event && event.isLoading && loadingState === 'loading') {
      console.log('[TeamEventDetailPage] Event initialized with skeleton, setting ready state');
      setIsLoadingEvent(false);
      setLoadingState('success');
      setLoadingStatus('Event ready');
    }
  }, [event, loadingState]);


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

  // Optimized leaderboard derived from activity feed (following League pattern)
  const sortedParticipants = useMemo(() => {
    if (!event || !participants.length) return [];
    
    // Use the optimized calculation that derives from activity feed
    return calculateLeaderboardFromFeed(enhancedFeedEvents, participants, event, publicKey);
  }, [enhancedFeedEvents, participants, event, publicKey]);

  // Calculate event statistics from the optimized leaderboard
  const eventStats = useMemo(() => {
    return calculateEventStats(sortedParticipants);
  }, [sortedParticipants]);

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

          {/* Diagnostic Button - Always visible for debugging */}
          <div className="mb-2">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="text-xs text-white/60 hover:text-white underline"
            >
              {showDiagnostics ? 'Hide' : 'Show'} Diagnostics
            </button>
          </div>

          {/* Diagnostics Panel */}
          {showDiagnostics && (
            <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/50 rounded text-xs">
              <h4 className="text-blue-400 font-semibold mb-2">Event Participation Diagnostics:</h4>
              <div className="space-y-1 text-blue-200">
                <div>publicKey: {publicKey ? `${publicKey.slice(0, 8)}...${publicKey.slice(-4)}` : 'Not signed in'}</div>
                <div>eventId: {eventId || 'Missing'}</div>
                <div>isUserParticipating: {isUserParticipating ? 'YES' : 'NO'}</div>
                <div>isUserParticipatingLocally: {isUserParticipatingLocally ? 'YES' : 'NO'}</div>
                <div>isJoining: {isJoining ? 'YES' : 'NO'}</div>
                <div>ndkReady: {ndkReady ? 'YES' : 'NO'}</div>
                <div>Button shown: {isUserParticipating || isUserParticipatingLocally ? 'LEAVE' : 'JOIN'}</div>
              </div>
              <button
                onClick={() => {
                  // Clear localStorage participation for this event
                  if (typeof localStorage !== 'undefined' && eventId && publicKey) {
                    try {
                      // Clear event participants
                      const participants = JSON.parse(localStorage.getItem('eventParticipants') || '{}');
                      if (participants[eventId] && participants[eventId][publicKey]) {
                        delete participants[eventId][publicKey];
                        localStorage.setItem('eventParticipants', JSON.stringify(participants));
                      }
                      
                      // Clear user joined events
                      const userJoined = JSON.parse(localStorage.getItem('userJoinedEvents') || '{}');
                      if (userJoined[eventId]) {
                        delete userJoined[eventId];
                        localStorage.setItem('userJoinedEvents', JSON.stringify(userJoined));
                      }
                      
                      window.location.reload();
                    } catch (error) {
                      console.error('Error clearing participation:', error);
                    }
                  }
                }}
                className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
              >
                Clear Local Participation & Reload
              </button>
            </div>
          )}

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
                    onClick={handleJoinEvent}
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
        </div>

        {/* Tab Navigation (following League's simple interface) */}
        <div className="bg-black border border-white/20 overflow-hidden">
          <div className="flex border-b border-white/20">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'feed'
                  ? 'bg-white text-black border-b-2 border-white'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              Activity Feed
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'leaderboard'
                  ? 'bg-white text-black border-b-2 border-white'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              Leaderboard
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'info'
                  ? 'bg-white text-black border-b-2 border-white'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              Event Info
            </button>
          </div>
          
          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'feed' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-white">Event Activity Feed</h2>
                  <div className="flex items-center gap-2">
                    {activityFeedError && (
                      <span className="text-xs text-white/60" title={activityFeedError}>⚠️</span>
                    )}
                    <span className="text-sm text-white/60">
                      {enhancedFeedEvents.length} workout{enhancedFeedEvents.length !== 1 ? 's' : ''}
                    </span>
                    {feedLastUpdated && (
                      <span className="text-xs text-white/40">
                        • Updated {feedLastUpdated.toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Loading progress indicator */}
                {isLoadingActivityFeed && enhancedFeedEvents.length === 0 && (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-white mb-2">{feedLoadingProgress.message}</p>
                    {feedLoadingProgress.participantCount > 0 && (
                      <p className="text-sm text-white/60">
                        {feedLoadingProgress.participantCount} participants • {feedLoadingProgress.processedEvents} events processed
                      </p>
                    )}
                  </div>
                )}
                
                {/* Activity Feed Error */}
                {activityFeedError && enhancedFeedEvents.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-red-400 mb-2">❌ Error loading activity feed</p>
                    <p className="text-sm text-white/60 mb-4">{activityFeedError}</p>
                    <button
                      onClick={refreshActivityFeed}
                      className="px-4 py-2 bg-white text-black rounded hover:bg-white/90 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}
                
                {/* Empty State */}
                {!isLoadingActivityFeed && enhancedFeedEvents.length === 0 && !activityFeedError && (
                  <div className="text-center py-12">
                    <p className="text-white mb-2">No activities yet</p>
                    <p className="text-sm text-gray-300">
                      Participant workouts during the event will appear here
                    </p>
                  </div>
                )}
                
                {/* Activity Feed (following League's Post component pattern) */}
                {enhancedFeedEvents.length > 0 && (
                  <div className="space-y-4">
                    {enhancedFeedEvents.map((event, index) => {
                      // Transform to Post-compatible format (same as League)
                      const post = {
                        id: event.id,
                        kind: 1301,
                        content: event.content || '',
                        created_at: event.created_at || Math.floor(Date.now() / 1000),
                        title: event.title || 'Event Workout',
                        author: {
                          pubkey: event.pubkey,
                          profile: {
                            name: event.displayName,
                            display_name: event.displayName,
                            picture: event.picture,
                            about: event.about || '',
                            nip05: event.profile?.nip05
                          }
                        },
                        tags: event.tags || [],
                        zaps: 0, // Keep simple for events
                        activityType: event.activityType,
                        rawEvent: event.rawEvent
                      };

                      return (
                        <div key={event.id || index} className="bg-black border border-white/20 rounded-lg overflow-hidden">
                          <Post 
                            post={post} 
                            handleZap={() => {}} 
                            wallet={null}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'leaderboard' && (
              <div>
                <div className="flex justify-between items-center mb-4">
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
                
                {isLoadingParticipants ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-white text-sm">Loading participants...</p>
                  </div>
                ) : (
                  renderLeaderboard()
                )}
              </div>
            )}
            
            {activeTab === 'info' && (
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">Event Information</h2>
                
                {/* Event Details */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-white/70 mb-1">Activity</h3>
                      <p className="text-white">{event?.activity || 'run'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white/70 mb-1">Distance</h3>
                      <p className="text-white">{event?.distance || 0}km</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-white/70 mb-1">Date</h3>
                      <p className="text-white">{new Date(event?.date || Date.now()).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white/70 mb-1">Status</h3>
                      <div className="flex items-center gap-2">
                        {event && getStatusBadge(status)}
                      </div>
                    </div>
                  </div>
                  
                  {event?.startTime && event?.endTime && (
                    <div>
                      <h3 className="text-sm font-medium text-white/70 mb-1">Time</h3>
                      <p className="text-white">{event.startTime} - {event.endTime}</p>
                    </div>
                  )}
                  
                  {event?.description && (
                    <div>
                      <h3 className="text-sm font-medium text-white/70 mb-1">Description</h3>
                      <p className="text-white">{event.description}</p>
                    </div>
                  )}
                  
                  {/* Enhanced Event Statistics */}
                  <div className="mt-6 pt-4 border-t border-white/20">
                    <h3 className="text-sm font-medium text-white/70 mb-4">Event Statistics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-bold text-white">{eventStats.totalParticipants}</p>
                        <p className="text-sm text-white/60">Total Participants</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{eventStats.activeParticipants}</p>
                        <p className="text-sm text-white/60">Active Participants</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{eventStats.totalWorkouts}</p>
                        <p className="text-sm text-white/60">Total Workouts</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{eventStats.completedParticipants}</p>
                        <p className="text-sm text-white/60">Completed Event</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{eventStats.totalDistance} km</p>
                        <p className="text-sm text-white/60">Total Distance</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{eventStats.completionRate}%</p>
                        <p className="text-sm text-white/60">Completion Rate</p>
                      </div>
                    </div>
                  </div>
                </div>
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