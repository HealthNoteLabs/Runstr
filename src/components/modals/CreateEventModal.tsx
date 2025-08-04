import React, { useState } from 'react';
import { useNostr } from '../../hooks/useNostr';
import { createTeamEvent } from '../../services/nostr/NostrTeamsService';
import toast from 'react-hot-toast';

interface CreateEventModalProps {
  teamAIdentifier: string;
  onClose: () => void;
  onEventCreated: () => void;
}

const CreateEventModal: React.FC<CreateEventModalProps> = ({ 
  teamAIdentifier, 
  onClose, 
  onEventCreated 
}) => {
  const { ndk, publicKey } = useNostr();
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [activity, setActivity] = useState<'run' | 'walk' | 'cycle'>('run');
  const [distance, setDistance] = useState('5');
  const [customDistance, setCustomDistance] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  
  // Reward state
  const [participationReward, setParticipationReward] = useState('');
  const [firstPlaceReward, setFirstPlaceReward] = useState('');
  const [secondPlaceReward, setSecondPlaceReward] = useState('');
  const [thirdPlaceReward, setThirdPlaceReward] = useState('');

  const distancePresets = [
    { label: '5K', value: '5' },
    { label: '10K', value: '10' },
    { label: 'Half Marathon', value: '21.1' },
    { label: 'Marathon', value: '42.2' },
    { label: 'Custom', value: 'custom' }
  ];

  const eventTemplates = [
    {
      name: 'Weekly 5K',
      activity: 'run' as const,
      distance: '5',
      startTime: '08:00',
      endTime: '12:00'
    },
    {
      name: 'Saturday Long Run', 
      activity: 'run' as const,
      distance: '10',
      startTime: '07:00',
      endTime: '11:00'
    },
    {
      name: 'Team Challenge',
      activity: 'run' as const, 
      distance: '21.1',
      startTime: '09:00',
      endTime: '15:00'
    },
    {
      name: 'Morning Walk',
      activity: 'walk' as const,
      distance: '5',
      startTime: '07:30',
      endTime: '09:30'
    }
  ];

  const applyTemplate = (template: typeof eventTemplates[0]) => {
    setEventName(template.name);
    setActivity(template.activity);
    setDistance(template.distance);
    setStartTime(template.startTime);
    setEndTime(template.endTime);
    
    // Set to next Saturday
    const nextSaturday = new Date();
    const daysUntilSaturday = (6 - nextSaturday.getDay()) % 7 || 7;
    nextSaturday.setDate(nextSaturday.getDate() + daysUntilSaturday);
    setEventDate(nextSaturday.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ndk || !publicKey) {
      toast.error('Not connected to Nostr');
      return;
    }

    if (!eventName.trim() || !eventDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    const finalDistance = distance === 'custom' ? customDistance : distance;
    if (!finalDistance || parseFloat(finalDistance) <= 0) {
      toast.error('Please enter a valid distance');
      return;
    }

    setIsCreating(true);
    const toastId = toast.loading('Creating event...');

    try {
      // Parse reward values
      const parsedParticipationReward = participationReward ? parseInt(participationReward) : undefined;
      const parsedFirstPlace = firstPlaceReward ? parseInt(firstPlaceReward) : undefined;
      const parsedSecondPlace = secondPlaceReward ? parseInt(secondPlaceReward) : undefined;
      const parsedThirdPlace = thirdPlaceReward ? parseInt(thirdPlaceReward) : undefined;

      await createTeamEvent(ndk, {
        teamAIdentifier,
        name: eventName.trim(),
        description: eventDescription.trim() || undefined,
        activity,
        distance: parseFloat(finalDistance),
        date: eventDate,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        creatorPubkey: publicKey,
        participationReward: parsedParticipationReward,
        winnerRewards: (parsedFirstPlace || parsedSecondPlace || parsedThirdPlace) ? {
          first: parsedFirstPlace,
          second: parsedSecondPlace,
          third: parsedThirdPlace
        } : undefined
      });

      toast.success('Event created successfully!', { id: toastId });
      onEventCreated();
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event', { id: toastId });
    } finally {
      setIsCreating(false);
    }
  };

  // Allow today's date for event creation
  const today = new Date();
  const minDate = today.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto border border-white">
        <div className="p-6 border-b border-white">
          <h2 className="text-xl font-bold text-white">Create Team Event</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Quick Templates */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Quick Templates
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {eventTemplates.map((template, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="px-3 py-2 text-sm bg-black hover:bg-white hover:text-black text-white rounded-lg transition-colors border border-white"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          {/* Event Name */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Event Name *
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Saturday Morning 5K"
              className="w-full px-4 py-2 bg-black border border-white rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-300"
              required
            />
          </div>

          {/* Event Description */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Description (Optional)
            </label>
            <textarea
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder="Meet at Central Park entrance, bring water..."
              rows={3}
              className="w-full px-4 py-2 bg-black border border-white rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-300 resize-vertical"
            />
          </div>

          {/* Activity Type */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Activity Type *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['run', 'walk', 'cycle'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActivity(type)}
                  className={`px-4 py-2 rounded-lg capitalize font-semibold transition-colors ${
                    activity === type
                      ? 'bg-white text-black border-2 border-white'
                      : 'bg-black text-white hover:bg-gray-900 border-2 border-white'
                  }`}
                >
                  {type === 'run' ? 'Run' : type === 'walk' ? 'Walk' : 'Cycle'}
                </button>
              ))}
            </div>
          </div>

          {/* Distance */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Distance *
            </label>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {distancePresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setDistance(preset.value)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    distance === preset.value
                      ? 'bg-white text-black border-2 border-white'
                      : 'bg-black text-white hover:bg-gray-900 border-2 border-white'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {distance === 'custom' && (
              <div className="relative">
                <input
                  type="number"
                  value={customDistance}
                  onChange={(e) => setCustomDistance(e.target.value)}
                  placeholder="Enter distance"
                  step="0.1"
                  min="0.1"
                  className="w-full px-4 py-2 pr-12 bg-black border border-white rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-300"
                  required
                />
                <span className="absolute right-3 top-2 text-white text-sm">km</span>
              </div>
            )}
          </div>

          {/* Event Date */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Event Date *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              min={minDate}
              className="w-full px-4 py-2 bg-black border border-white rounded-lg text-white focus:outline-none focus:border-gray-300"
              required
            />
          </div>

          {/* Time Window (Optional) */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Time Window (Optional)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="Start time"
                className="px-4 py-2 bg-black border border-white rounded-lg text-white focus:outline-none focus:border-gray-300"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="End time"
                className="px-4 py-2 bg-black border border-white rounded-lg text-white focus:outline-none focus:border-gray-300"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Leave empty to allow participation all day
            </p>
          </div>

          {/* Participation Reward (Optional) */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Participation Reward (Optional)
            </label>
            <div className="relative">
              <input
                type="number"
                value={participationReward}
                onChange={(e) => setParticipationReward(e.target.value)}
                placeholder="245"
                min="0"
                className="w-full px-4 py-2 pr-12 bg-black border border-white rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-300"
              />
              <span className="absolute right-3 top-2 text-white text-sm">sats</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Reward for all participants who complete the event
            </p>
          </div>

          {/* Winner Rewards (Optional) */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Winner Rewards (Optional)
            </label>
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="number"
                  value={firstPlaceReward}
                  onChange={(e) => setFirstPlaceReward(e.target.value)}
                  placeholder="1000"
                  min="0"
                  className="w-full px-4 py-2 pr-12 bg-black border border-white rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-300"
                />
                <span className="absolute right-3 top-2 text-white text-sm">sats</span>
                <span className="absolute left-3 top-2 text-white text-sm bg-black px-1">1st</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={secondPlaceReward}
                  onChange={(e) => setSecondPlaceReward(e.target.value)}
                  placeholder="500"
                  min="0"
                  className="w-full px-4 py-2 pr-12 pl-12 bg-black border border-white rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-300"
                />
                <span className="absolute right-3 top-2 text-white text-sm">sats</span>
                <span className="absolute left-3 top-2 text-white text-sm bg-black px-1">2nd</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={thirdPlaceReward}
                  onChange={(e) => setThirdPlaceReward(e.target.value)}
                  placeholder="250"
                  min="0"
                  className="w-full px-4 py-2 pr-12 pl-12 bg-black border border-white rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-gray-300"
                />
                <span className="absolute right-3 top-2 text-white text-sm">sats</span>
                <span className="absolute left-3 top-2 text-white text-sm bg-black px-1">3rd</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Rewards will be sent manually by the captain after the event
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="px-6 py-2 bg-black hover:bg-gray-900 text-white rounded-lg transition-colors disabled:opacity-50 border border-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-6 py-2 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 border-2 border-white"
            >
              {isCreating ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEventModal;