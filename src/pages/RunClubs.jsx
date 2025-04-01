import { useState, useEffect } from 'react';
import { useRunClub } from '../contexts/RunClubContext';
import { useEvent } from '../contexts/EventContext';
import { ChatRoom } from '../components/ChatRoom';
import { EventCreationModal } from '../components/EventCreationModal';
import { EventLeaderboard } from '../components/EventLeaderboard';

export const RunClubs = () => {
  const { clubs, createClub, joinClub, isClubManager } = useRunClub();
  const { getActiveEvent } = useEvent();
  const [selectedClubId, setSelectedClubId] = useState(null);
  const [showCreateClubModal, setShowCreateClubModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [clubCode, setClubCode] = useState('');
  const [activeEvent, setActiveEvent] = useState(null);

  useEffect(() => {
    if (selectedClubId) {
      const loadEvents = async () => {
        const currentEvent = await getActiveEvent(selectedClubId);
        setActiveEvent(currentEvent);
      };
      loadEvents();
    }
  }, [selectedClubId, getActiveEvent]);

  const handleCreateClub = () => {
    if (!clubName.trim() || !clubDescription.trim()) return;

    const newClub = createClub(clubName.trim(), clubDescription.trim());
    if (newClub) {
      setShowCreateClubModal(false);
      setClubName('');
      setClubDescription('');
    }
  };

  const handleJoinClub = () => {
    if (!clubCode.trim()) return;

    const joined = joinClub(clubCode.trim());
    if (joined) {
      setClubCode('');
    }
  };

  if (selectedClubId) {
    const club = clubs.find(c => c.id === selectedClubId);
    if (!club) return null;

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{club.name}</h1>
          <button
            onClick={() => setSelectedClubId(null)}
            className="px-4 py-2 rounded-lg bg-gray-700 text-white"
          >
            Back to Clubs
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Club Chat</h2>
              {isClubManager(selectedClubId) && (
                <button
                  onClick={() => setShowEventModal(true)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
                >
                  Create Event
                </button>
              )}
            </div>
            <ChatRoom clubId={selectedClubId} />
          </div>

          <div>
            {activeEvent ? (
              <>
                <h2 className="text-xl font-bold mb-4">Current Event</h2>
                <div className="bg-[#1a222e] rounded-xl p-6 mb-6">
                  <h3 className="text-lg font-bold mb-2">{activeEvent.name}</h3>
                  <p className="text-gray-400 mb-4">{activeEvent.description}</p>
                  <div className="text-sm text-gray-500">
                    <div>⏱️ Starts: {new Date(activeEvent.startTime).toLocaleString()}</div>
                    <div>🏁 Ends: {new Date(activeEvent.endTime).toLocaleString()}</div>
                    {activeEvent.distance && (
                      <div>🛣️ Distance: {activeEvent.distance}km</div>
                    )}
                  </div>
                </div>
                <EventLeaderboard eventId={activeEvent.id} clubId={selectedClubId} />
              </>
            ) : (
              <div className="bg-[#1a222e] rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4">No Active Event</h2>
                <p className="text-gray-400">
                  {isClubManager(selectedClubId)
                    ? 'Create an event to get started!'
                    : 'Check back later for upcoming events.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {showEventModal && (
          <EventCreationModal
            clubId={selectedClubId}
            managerId={club.managerId}
            onClose={() => setShowEventModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Run Clubs</h1>
        <button
          onClick={() => setShowCreateClubModal(true)}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
        >
          Create Club
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clubs.map(club => (
          <div
            key={club.id}
            className="bg-[#1a222e] rounded-xl p-6 cursor-pointer hover:bg-[#1f2937] transition-colors"
            onClick={() => setSelectedClubId(club.id)}
          >
            <h2 className="text-xl font-bold mb-2">{club.name}</h2>
            <p className="text-gray-400 mb-4">{club.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {club.members.length} members
              </span>
              <button
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedClubId(club.id);
                }}
              >
                Open Chat
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreateClubModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-[#1a222e] rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Club</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-2">Club Name</label>
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className="w-full bg-[#111827] border border-gray-700 rounded-lg p-3 text-white"
                  placeholder="Enter club name"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-2">Description</label>
                <textarea
                  value={clubDescription}
                  onChange={(e) => setClubDescription(e.target.value)}
                  className="w-full bg-[#111827] border border-gray-700 rounded-lg p-3 text-white"
                  placeholder="Enter club description"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateClubModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateClub}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
              >
                Create Club
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Join a Club</h2>
        <div className="flex space-x-4">
          <input
            type="text"
            value={clubCode}
            onChange={(e) => setClubCode(e.target.value)}
            className="flex-1 bg-[#111827] border border-gray-700 rounded-lg p-3 text-white"
            placeholder="Enter club code"
          />
          <button
            onClick={handleJoinClub}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
          >
            Join Club
          </button>
        </div>
      </div>
    </div>
  );
}; 