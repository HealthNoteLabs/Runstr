import React, { useState, useEffect } from 'react';
import { TeamEventDetails } from '../../services/nostr/NostrTeamsService';
import { EventJoinStorage, EventsService } from '../../services/EventsService';
import toast from 'react-hot-toast';

interface EventJoinModalProps {
  event: TeamEventDetails;
  onClose: () => void;
  onJoin: () => void;
}

const EventJoinModal: React.FC<EventJoinModalProps> = ({ event, onClose, onJoin }) => {
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Check if user has already joined this event
  useEffect(() => {
    setIsJoined(EventJoinStorage.hasJoinedEvent(event.id));
  }, [event.id]);

  const handleJoinEvent = async () => {
    setIsJoining(true);
    try {
      const success = EventJoinStorage.joinEvent(event.id, event.name, event.date);
      if (success) {
        setIsJoined(true);
        onJoin();
        toast.success(`Joined ${event.name}! Your workouts during the event will be tracked.`);
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
    setIsJoining(true);
    try {
      const success = EventJoinStorage.leaveEvent(event.id);
      if (success) {
        setIsJoined(false);
        toast.success(`Left ${event.name}`);
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

  const getEventStatus = () => {
    return EventsService.getEventStatus(event);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-3 py-1 text-sm rounded-full bg-gray-100 text-gray-800">
            Completed
          </span>
        );
      case 'active':
        return (
          <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-800 animate-pulse">
            🔴 Live Now
          </span>
        );
      case 'upcoming':
        return (
          <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800">
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
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    });
  };

  const status = getEventStatus();
  const canJoin = status !== 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-bg-secondary rounded-xl w-full max-w-md p-6 shadow-lg border border-border-secondary">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{getActivityIcon(event.activity)}</span>
            <div>
              <h2 className="text-xl font-bold text-text-primary">{event.name}</h2>
              <p className="text-sm text-text-secondary">
                {event.distance}km {event.activity}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Event Status */}
        <div className="mb-4">
          {getStatusBadge(status)}
        </div>

        {/* Event Details */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center space-x-3">
            <span className="text-lg">📅</span>
            <span className="text-text-primary">{formatEventDate(event.date)}</span>
          </div>
          
          {event.startTime && event.endTime && (
            <div className="flex items-center space-x-3">
              <span className="text-lg">🕐</span>
              <span className="text-text-primary">
                {event.startTime} - {event.endTime}
              </span>
            </div>
          )}
          
          <div className="flex items-center space-x-3">
            <span className="text-lg">📏</span>
            <span className="text-text-primary">{event.distance}km {event.activity}</span>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-text-secondary mb-2">Description</h3>
            <p className="text-text-primary text-sm bg-bg-tertiary p-3 rounded-lg border border-border-secondary">
              {event.description}
            </p>
          </div>
        )}

        {/* Join Status Info */}
        {isJoined && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✅</span>
              <span className="text-sm text-green-800 font-medium">
                You've joined this event!
              </span>
            </div>
            <p className="text-xs text-green-700 mt-1">
              Your workouts during the event timeframe will be automatically tagged and included in the leaderboard.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {isJoined ? (
            <button
              onClick={handleLeaveEvent}
              disabled={isJoining}
              className="flex-1 px-4 py-3 bg-bg-tertiary hover:bg-bg-primary text-text-primary font-medium rounded-lg transition-colors border border-border-secondary disabled:opacity-50"
            >
              {isJoining ? 'Leaving...' : 'Leave Event'}
            </button>
          ) : (
            <button
              onClick={handleJoinEvent}
              disabled={isJoining || !canJoin}
              className="flex-1 px-4 py-3 bg-primary hover:bg-primary-hover text-text-inverse font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? 'Joining...' : canJoin ? 'Join Event' : 'Event Completed'}
            </button>
          )}
          
          <button
            onClick={onClose}
            className="px-4 py-3 bg-bg-tertiary hover:bg-bg-primary text-text-primary font-medium rounded-lg transition-colors border border-border-secondary"
          >
            Close
          </button>
        </div>

        {/* Instructions for joined users */}
        {isJoined && (
          <div className="mt-4 p-3 bg-bg-tertiary rounded-lg border border-border-secondary">
            <h4 className="text-sm font-medium text-text-primary mb-1">Next Steps:</h4>
            <ul className="text-xs text-text-secondary space-y-1">
              <li>• Complete your {event.activity} during the event timeframe</li>
              <li>• Your workout will be automatically tagged with this event</li>
              <li>• View the leaderboard to see how you compare with other participants</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventJoinModal;