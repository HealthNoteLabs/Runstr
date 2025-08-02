import React, { useState, useEffect } from 'react';
import { useNostr } from '../hooks/useNostr';
import { TeamEventDetails } from '../services/nostr/NostrTeamsService';
import EventJoinModal from '../components/modals/EventJoinModal';
import { EventsService } from '../services/EventsService';
import toast from 'react-hot-toast';

const EventsPage: React.FC = () => {
  const { ndk, ndkReady } = useNostr();
  const [events, setEvents] = useState<TeamEventDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TeamEventDetails | null>(null);

  useEffect(() => {
    const loadEvents = async () => {
      if (!ndk || !ndkReady) {
        return;
      }

      try {
        console.log('[EventsPage] Loading all team events...');
        setError(null);
        
        const allEvents = await EventsService.fetchAllTeamEvents(ndk);
        setEvents(allEvents);
        console.log(`[EventsPage] Loaded ${allEvents.length} events`);
      } catch (err) {
        console.error('[EventsPage] Error loading events:', err);
        setError('Failed to load events. Please try again.');
        toast.error('Failed to load events');
      } finally {
        setIsLoading(false);
      }
    };

    loadEvents();
  }, [ndk, ndkReady]);

  const getEventStatus = (event: TeamEventDetails): string => {
    const now = new Date();
    const eventDate = new Date(event.date);
    
    // Handle time-specific events
    if (event.startTime && event.endTime) {
      const eventStart = new Date(`${event.date}T${event.startTime}:00`);
      const eventEnd = new Date(`${event.date}T${event.endTime}:00`);
      
      if (now > eventEnd) {
        return 'completed';
      } else if (now >= eventStart && now <= eventEnd) {
        return 'active';
      } else {
        return 'upcoming';
      }
    }
    
    // Handle all-day events
    const eventStart = new Date(event.date + 'T00:00:00');
    const eventEnd = new Date(event.date + 'T23:59:59');
    
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
          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
            Completed
          </span>
        );
      case 'active':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 animate-pulse">
            Live Now
          </span>
        );
      case 'upcoming':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
            Upcoming
          </span>
        );
      default:
        return null;
    }
  };

  const getActivityIcon = (activity: string) => {
    switch (activity) {
      case 'run':
        return '🏃‍♂️';
      case 'walk':
        return '🚶‍♂️';
      case 'cycle':
        return '🚴‍♂️';
      default:
        return '🏃‍♂️';
    }
  };

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Team Events</h1>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading events...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Team Events</h1>
          <div className="text-center py-12">
            <div className="text-error text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">Connection Problem</h2>
            <p className="text-text-secondary mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-text-inverse rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Team Events</h1>
        
        {events.length === 0 ? (
          <div className="text-center py-12 bg-bg-secondary rounded-lg border border-border-secondary">
            <div className="text-4xl mb-4">🏃‍♂️</div>
            <h2 className="text-xl font-semibold mb-2">No Events Available</h2>
            <p className="text-text-secondary">
              No team events are currently available. Check back later!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.filter(event => getEventStatus(event) !== 'completed').map((event) => {
              const status = getEventStatus(event);
              return (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="bg-bg-secondary border border-border-secondary rounded-lg p-4 hover:bg-bg-tertiary transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getActivityIcon(event.activity)}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-text-primary">{event.name}</h3>
                        <p className="text-sm text-text-secondary">
                          {event.distance}km {event.activity}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(status)}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-text-secondary">
                    <div className="flex items-center space-x-4">
                      <span>📅 {formatEventDate(event.date)}</span>
                      {event.startTime && (
                        <span>🕐 {event.startTime}</span>
                      )}
                    </div>
                    <span className="text-xs text-text-muted">
                      Click to join
                    </span>
                  </div>
                  
                  {event.description && (
                    <p className="text-sm text-text-muted mt-2 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedEvent && (
        <EventJoinModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onJoin={() => {
            // Handle join success
            setSelectedEvent(null);
            toast.success('Successfully joined event! 🎉');
          }}
        />
      )}
    </div>
  );
};

export default EventsPage;