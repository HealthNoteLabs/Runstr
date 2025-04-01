import { useState } from 'react';
import PropTypes from 'prop-types';
import { useEvent } from '../contexts/EventContext';
import { useChat } from '../contexts/ChatContext';

export const EventCreationModal = ({ clubId, managerId, onClose }) => {
  const { createEvent } = useEvent();
  const { sendMessage } = useChat();
  const [eventName, setEventName] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [endTime, setEndTime] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [distance, setDistance] = useState('');

  const handleCreateEvent = () => {
    if (!eventName.trim() || !description.trim()) return;

    const newEvent = createEvent(
      clubId,
      managerId,
      eventName.trim(),
      description.trim(),
      startTime,
      endTime,
      distance ? parseFloat(distance) : null
    );

    if (newEvent) {
      // Create a pinned post for the event
      const eventAnnouncement = 
        `🏃 EVENT: ${eventName}\n` +
        `📝 ${description}\n` +
        `⏱️ Starts: ${new Date(startTime).toLocaleString()}\n` +
        `🏁 Ends: ${new Date(endTime).toLocaleString()}\n` +
        (distance ? `🛣️ Distance: ${distance}km\n` : '') +
        `Join in and compete on the leaderboard!`;

      sendMessage(clubId, managerId, 'Club Manager', eventAnnouncement);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-[#1a222e] rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Create Club Event</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 mb-2">Event Name</label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full bg-[#111827] border border-gray-700 rounded-lg p-3 text-white"
              placeholder="e.g., Weekend 5K Challenge"
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#111827] border border-gray-700 rounded-lg p-3 text-white"
              placeholder="Event details..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-2">Start Time</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-[#111827] border border-gray-700 rounded-lg p-3 text-white"
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-2">End Time</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-[#111827] border border-gray-700 rounded-lg p-3 text-white"
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-2">Distance (km, optional)</label>
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full bg-[#111827] border border-gray-700 rounded-lg p-3 text-white"
              placeholder="e.g., 5"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateEvent}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
          >
            Create Event
          </button>
        </div>
      </div>
    </div>
  );
};

EventCreationModal.propTypes = {
  clubId: PropTypes.string.isRequired,
  managerId: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired
}; 