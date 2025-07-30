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
  const [activity, setActivity] = useState<'run' | 'walk' | 'cycle'>('run');
  const [distance, setDistance] = useState('5');
  const [customDistance, setCustomDistance] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const distancePresets = [
    { label: '5K', value: '5' },
    { label: '10K', value: '10' },
    { label: 'Half Marathon', value: '21.1' },
    { label: 'Marathon', value: '42.2' },
    { label: 'Custom', value: 'custom' }
  ];

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
      await createTeamEvent(ndk, {
        teamAIdentifier,
        name: eventName.trim(),
        activity,
        distance: parseFloat(finalDistance),
        date: eventDate,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        creatorPubkey: publicKey
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

  // Get tomorrow's date as minimum date for event
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Create Team Event</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Event Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Event Name *
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Saturday Morning 5K"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white"
              required
            />
          </div>

          {/* Activity Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Activity Type *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['run', 'walk', 'cycle'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActivity(type)}
                  className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                    activity === type
                      ? 'bg-white text-black border-2 border-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border-2 border-gray-700'
                  }`}
                >
                  {type === 'run' ? '🏃 Run' : type === 'walk' ? '🚶 Walk' : '🚴 Cycle'}
                </button>
              ))}
            </div>
          </div>

          {/* Distance */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
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
                      ? 'bg-white text-black border-2 border-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border-2 border-gray-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {distance === 'custom' && (
              <input
                type="number"
                value={customDistance}
                onChange={(e) => setCustomDistance(e.target.value)}
                placeholder="Enter distance in km"
                step="0.1"
                min="0.1"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white"
                required
              />
            )}
          </div>

          {/* Event Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Event Date *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              min={minDate}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-white"
              required
            />
          </div>

          {/* Time Window (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Time Window (Optional)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="Start time"
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-white"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="End time"
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-white"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to allow participation all day
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
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