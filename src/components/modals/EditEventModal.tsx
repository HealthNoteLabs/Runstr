import React, { useState } from 'react';
import { useNostr } from '../../hooks/useNostr';
import { TeamEventDetails, updateTeamEvent } from '../../services/nostr/NostrTeamsService';
import toast from 'react-hot-toast';

interface EditEventModalProps {
  event: TeamEventDetails;
  onClose: () => void;
  onEventUpdated: () => void;
}

const EditEventModal: React.FC<EditEventModalProps> = ({ 
  event, 
  onClose, 
  onEventUpdated 
}) => {
  const { ndk, publicKey } = useNostr();
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Form state initialized with current event data
  const [eventName, setEventName] = useState(event.name);
  const [eventDescription, setEventDescription] = useState(event.description || '');
  const [activity, setActivity] = useState<'run' | 'walk' | 'cycle'>(event.activity);
  const [distance, setDistance] = useState(event.distance.toString());
  const [customDistance, setCustomDistance] = useState('');
  const [eventDate, setEventDate] = useState(event.date);
  const [startTime, setStartTime] = useState(event.startTime || '');
  const [endTime, setEndTime] = useState(event.endTime || '');

  const distancePresets = [
    { label: '5K', value: '5' },
    { label: '10K', value: '10' },
    { label: 'Half Marathon', value: '21.1' },
    { label: 'Marathon', value: '42.2' },
    { label: 'Custom', value: 'custom' }
  ];

  // Set custom distance if current distance doesn't match presets
  React.useEffect(() => {
    const matchesPreset = distancePresets.some(preset => preset.value === distance);
    if (!matchesPreset) {
      setDistance('custom');
      setCustomDistance(event.distance.toString());
    }
  }, []);

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

    setIsUpdating(true);
    const toastId = toast.loading('Updating event...');

    try {
      await updateTeamEvent(ndk, {
        eventId: event.id,
        teamAIdentifier: event.teamAIdentifier,
        name: eventName.trim(),
        description: eventDescription.trim() || undefined,
        activity,
        distance: parseFloat(finalDistance),
        date: eventDate,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        creatorPubkey: publicKey
      });

      toast.success('Event updated successfully!', { id: toastId });
      onEventUpdated();
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event', { id: toastId });
    } finally {
      setIsUpdating(false);
    }
  };

  // Get today's date as minimum date for event
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto border border-white">
        <div className="p-6 border-b border-white">
          <h2 className="text-xl font-bold text-white">Edit Team Event</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Event Name */}
          <div>
            <label className="block text-sm font-medium text-white00 mb-2">
              Event Name *
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Saturday Morning 5K"
              className="w-full px-4 py-2 bg-black00 border border-white00 rounded-lg text-white placeholder-gray-40000 focus:outline-none focus:border-gray-300"
              required
            />
          </div>

          {/* Event Description */}
          <div>
            <label className="block text-sm font-medium text-white00 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              placeholder="Meet at Central Park entrance, bring water..."
              rows={3}
              className="w-full px-4 py-2 bg-black00 border border-white00 rounded-lg text-white placeholder-gray-40000 focus:outline-none focus:border-gray-300 resize-vertical"
            />
          </div>

          {/* Activity Type */}
          <div>
            <label className="block text-sm font-medium text-white00 mb-2">
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
                      : 'bg-black00 text-white00 hover:bg-gray-90000 border-2 border-white00'
                  }`}
                >
                  {type === 'run' ? '🏃 Run' : type === 'walk' ? '🚶 Walk' : '🚴 Cycle'}
                </button>
              ))}
            </div>
          </div>

          {/* Distance */}
          <div>
            <label className="block text-sm font-medium text-white00 mb-2">
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
                      : 'bg-black00 text-white00 hover:bg-gray-90000 border-2 border-white00'
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
                className="w-full px-4 py-2 bg-black00 border border-white00 rounded-lg text-white placeholder-gray-40000 focus:outline-none focus:border-gray-300"
                required
              />
            )}
          </div>

          {/* Event Date */}
          <div>
            <label className="block text-sm font-medium text-white00 mb-2">
              Event Date *
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              min={today}
              className="w-full px-4 py-2 bg-black00 border border-white00 rounded-lg text-white focus:outline-none focus:border-gray-300"
              required
            />
          </div>

          {/* Time Window (Optional) */}
          <div>
            <label className="block text-sm font-medium text-white00 mb-2">
              Time Window (Optional)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="Start time"
                className="px-4 py-2 bg-black00 border border-white00 rounded-lg text-white focus:outline-none focus:border-gray-300"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="End time"
                className="px-4 py-2 bg-black00 border border-white00 rounded-lg text-white focus:outline-none focus:border-gray-300"
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
              disabled={isUpdating}
              className="px-6 py-2 bg-black00 hover:bg-gray-90000 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="px-6 py-2 bg-black hover:bg-black text-white font-semibold rounded-lg transition-colors disabled:opacity-50 border-2 border-white"
            >
              {isUpdating ? 'Updating...' : 'Update Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEventModal;