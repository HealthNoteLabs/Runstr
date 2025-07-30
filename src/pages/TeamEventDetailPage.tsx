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
  const { ndk, ndkReady, publicKey } = useNostr();

  const [event, setEvent] = useState<TeamEventDetails | null>(null);
  const [participants, setParticipants] = useState<EventParticipation[]>([]);
  const [participantPubkeys, setParticipantPubkeys] = useState<string[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isParticipating, setIsParticipating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

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

  // Load event details
  useEffect(() => {
    const loadEvent = async () => {
      if (!ndk || !ndkReady || !eventId || !teamAIdentifier) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch team events and find the specific event
        const teamEvents = await fetchTeamEvents(ndk, teamAIdentifier);
        const foundEvent = teamEvents.find(e => e.id === eventId);
        
        if (!foundEvent) {
          toast.error('Event not found');
          navigate(`/teams/${captainPubkey}/${teamUUID}`);
          return;
        }

        setEvent(foundEvent);

        // Load participants and participation data in parallel
        const [eventParticipants, participationData] = await Promise.all([
          fetchEventParticipants(ndk, eventId, teamAIdentifier),
          fetchEventParticipation(ndk, eventId, teamAIdentifier, foundEvent.date)
        ]);

        setParticipantPubkeys(eventParticipants);
        setParticipants(participationData);

        // Check if current user is participating
        if (publicKey) {
          const userIsParticipating = await isUserParticipating(ndk, eventId, teamAIdentifier, publicKey);
          setIsParticipating(userIsParticipating);
        }

        // Load event activities if we have participants
        if (eventParticipants.length > 0) {
          await loadEventActivities(foundEvent, eventParticipants);
        }

      } catch (error) {
        console.error('Error loading event:', error);
        toast.error('Failed to load event details');
      } finally {
        setIsLoading(false);
      }
    };

    loadEvent();
  }, [ndk, ndkReady, eventId, teamAIdentifier, publicKey, captainPubkey, teamUUID, navigate]);

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
            <div className="w-2 h-2 rounded-full bg-gray-500"></div>
            <span className="text-sm text-gray-400">Completed</span>
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
            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            <span className="text-sm text-gray-400">Upcoming</span>
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400">Loading event details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-black text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8">
            <p className="text-gray-400">Event not found</p>
            <button
              onClick={() => navigate(`/teams/${captainPubkey}/${teamUUID}`)}
              className="mt-4 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors"
            >
              Back to Team
            </button>
          </div>
        </div>
      </div>
    );
  }

  const status = getEventStatus();

  return (
    <div className="min-h-screen bg-black text-white">
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
            {publicKey && !isCaptain && (
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
                    className="px-4 py-2 bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 border-2 border-white"
                  >
                    {isJoining ? 'Joining...' : 'Join Event'}
                  </button>
                )}
              </>
            )}
            
            {isCaptain && (
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 bg-gray-800 hover:bg-white hover:text-black text-white text-sm rounded-lg transition-colors border border-gray-700 hover:border-white"
              >
                Edit Event
              </button>
            )}
          </div>
        </div>

        {/* Participants Section */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700 bg-gray-800">
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
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden mt-6">
          <div className="p-4 border-b border-gray-700 bg-gray-800">
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