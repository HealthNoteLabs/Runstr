import React, { useState, useEffect } from 'react';
import { useNostr } from '../../hooks/useNostr';
import { TeamEventDetails, fetchEventParticipation, EventParticipation } from '../../services/nostr/NostrTeamsService';
import { DisplayName } from '../shared/DisplayName';
import toast from 'react-hot-toast';

interface EventDetailModalProps {
  event: TeamEventDetails;
  teamAIdentifier: string;
  onClose: () => void;
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, teamAIdentifier, onClose }) => {
  const { ndk, ndkReady } = useNostr();
  const [participants, setParticipants] = useState<EventParticipation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadParticipants = async () => {
      if (!ndk || !ndkReady || !event) return;

      setIsLoading(true);
      try {
        const participation = await fetchEventParticipation(ndk, event.id, teamAIdentifier, event.date);
        setParticipants(participation);
      } catch (error) {
        console.error('Error fetching event participation:', error);
        toast.error('Failed to load event participants');
      } finally {
        setIsLoading(false);
      }
    };

    loadParticipants();
  }, [ndk, ndkReady, event, teamAIdentifier]);

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

  const getEventStatus = (): string => {
    const now = new Date();
    const eventDate = new Date(event.date);
    eventDate.setHours(23, 59, 59, 999);
    
    if (now > eventDate) {
      return 'completed';
    } else if (now.toDateString() === new Date(event.date).toDateString()) {
      return 'active';
    } else {
      return 'upcoming';
    }
  };

  const renderLeaderboard = () => {
    if (participants.length === 0) {
      return (
        <div className="text-center py-12 bg-gray-800/50 rounded-lg">
          <p className="text-gray-400">No participants yet</p>
          {getEventStatus() === 'upcoming' && (
            <p className="text-sm text-gray-500 mt-2">Check back on event day!</p>
          )}
        </div>
      );
    }

    // Sort participants by completion time
    const sortedParticipants = [...participants].sort((a, b) => {
      // DNF (Did Not Finish) goes to bottom
      if (a.distance < event.distance && b.distance >= event.distance) return 1;
      if (b.distance < event.distance && a.distance >= event.distance) return -1;
      
      // Sort by time for those who completed
      return a.duration - b.duration;
    });

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-12 gap-3 p-3 font-bold text-text-muted text-sm border-b border-border-secondary">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Participant</div>
          <div className="col-span-2 text-right">Time</div>
          <div className="col-span-2 text-right">Distance</div>
          <div className="col-span-3 text-right">Pace</div>
        </div>
        {sortedParticipants.map((participant, index) => {
          const completed = participant.distance >= event.distance;
          return (
            <div
              key={participant.pubkey}
              className={`grid grid-cols-12 gap-3 items-center p-3 rounded-lg ${
                completed ? 'bg-gray-800' : 'bg-gray-900/50'
              } border border-gray-700`}
            >
              <div className="col-span-1 font-bold">
                {completed ? (
                  <span className={index < 3 ? 'text-yellow-400' : 'text-gray-400'}>
                    {index + 1}
                  </span>
                ) : (
                  <span className="text-gray-600">-</span>
                )}
              </div>
              <div className="col-span-4">
                <DisplayName pubkey={participant.pubkey} />
              </div>
              <div className="col-span-2 text-right font-mono">
                {completed ? formatTime(participant.duration) : '-'}
              </div>
              <div className="col-span-2 text-right">
                <span className={completed ? 'text-green-400' : 'text-orange-400'}>
                  {participant.distance.toFixed(1)} km
                </span>
              </div>
              <div className="col-span-3 text-right text-gray-400">
                {completed ? formatPace(event.activity, participant.pace) : 'DNF'}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-800">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">{getActivityIcon(event.activity)}</span>
              <div>
                <h2 className="text-xl font-bold text-white">{event.name}</h2>
                <p className="text-gray-400">
                  {event.distance}km {event.activity} • {new Date(event.date).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Event Details */}
          <div className="mb-8 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Event Date</p>
              <p className="text-white">{new Date(event.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</p>
            </div>
            {event.startTime && (
              <div>
                <p className="text-sm text-gray-400">Time Window</p>
                <p className="text-white">
                  {event.startTime}
                  {event.endTime && ` - ${event.endTime}`}
                </p>
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Leaderboard {isLoading && <span className="text-sm text-gray-400 ml-2">Loading...</span>}
            </h3>
            {!isLoading && renderLeaderboard()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailModal;