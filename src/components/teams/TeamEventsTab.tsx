import React, { useState, useEffect } from 'react';
import { useNostr } from '../../hooks/useNostr';
import { fetchTeamEvents, TeamEventDetails } from '../../services/nostr/NostrTeamsService';
import CreateEventModal from '../modals/CreateEventModal';
import EventDetailModal from '../modals/EventDetailModal';
import toast from 'react-hot-toast';

interface TeamEventsTabProps {
  teamAIdentifier: string;
  isCaptain: boolean;
}

const TeamEventsTab: React.FC<TeamEventsTabProps> = ({ teamAIdentifier, isCaptain }) => {
  const { ndk, ndkReady } = useNostr();
  const [events, setEvents] = useState<TeamEventDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TeamEventDetails | null>(null);

  const loadEvents = async () => {
    if (!ndk || !ndkReady || !teamAIdentifier) return;
    
    setIsLoading(true);
    try {
      const teamEvents = await fetchTeamEvents(ndk, teamAIdentifier);
      setEvents(teamEvents);
    } catch (error) {
      console.error('Error fetching team events:', error);
      toast.error('Failed to load team events');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [ndk, ndkReady, teamAIdentifier]);

  const handleEventCreated = () => {
    setShowCreateModal(false);
    loadEvents(); // Reload events after creation
  };

  const getEventStatus = (event: TeamEventDetails): string => {
    const now = new Date();
    const eventDate = new Date(event.date);
    
    // Set event date to end of day for comparison
    eventDate.setHours(23, 59, 59, 999);
    
    if (now > eventDate) {
      return 'completed';
    } else if (now.toDateString() === new Date(event.date).toDateString()) {
      return 'active';
    } else {
      return 'upcoming';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-600 text-gray-200">Completed</span>;
      case 'active':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-600 text-white animate-pulse">Active</span>;
      case 'upcoming':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-600 text-white">Upcoming</span>;
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

  const getActivityIcon = (activity: string) => {
    switch (activity) {
      case 'run':
        return '🏃';
      case 'walk':
        return '🚶';
      case 'cycle':
        return '🚴';
      default:
        return '🏃';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-text-muted">Loading team events...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-100">Team Events</h3>
        {isCaptain && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg transition-colors border-2 border-white"
          >
            Create Event
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
          <p className="text-gray-400 mb-2">No events created yet.</p>
          {isCaptain && (
            <p className="text-sm text-gray-500">Create your first team event to get started!</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const status = getEventStatus(event);
            return (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getActivityIcon(event.activity)}</span>
                    <div>
                      <h4 className="text-lg font-semibold text-white">{event.name}</h4>
                      <p className="text-sm text-gray-400">
                        {event.distance}km {event.activity}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(status)}
                </div>
                <div className="flex justify-between items-center mt-3">
                  <p className="text-sm text-gray-400">
                    {formatEventDate(event.date)}
                    {event.startTime && ` • ${event.startTime}`}
                    {event.endTime && ` - ${event.endTime}`}
                  </p>
                  <p className="text-sm text-gray-500">
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

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          teamAIdentifier={teamAIdentifier}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
};

export default TeamEventsTab;