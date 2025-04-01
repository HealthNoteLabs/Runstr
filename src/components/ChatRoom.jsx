import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useChat } from '../contexts/ChatContext';
import { useRunClub } from '../contexts/RunClubContext';
import { useRunProfile } from '../hooks/useRunProfile';

export const ChatRoom = ({ clubId }) => {
  const { sendMessage, getClubMessages, pinMessage, getPinnedMessage } = useChat();
  const { getClubById } = useRunClub();
  const { profile } = useRunProfile();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const messagesEndRef = useRef(null);

  const club = getClubById(clubId);
  const isManager = club?.managerId === profile.id;
  const pinnedMessage = getPinnedMessage(clubId);

  // Load messages and set up auto-refresh
  useEffect(() => {
    const loadMessages = () => {
      const clubMessages = getClubMessages(clubId);
      setMessages(clubMessages);
    };

    loadMessages();
    const interval = setInterval(loadMessages, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [clubId, getClubMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    sendMessage(clubId, profile.id, profile.name, newMessage.trim());
    setNewMessage('');
  };

  const handlePinMessage = (messageId) => {
    pinMessage(messageId, clubId, profile.id);
    setShowPinModal(false);
  };

  if (!club) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Club not found</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Pinned Message */}
      {pinnedMessage && (
        <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 rounded-lg p-3 mb-4">
          <div className="flex items-center text-yellow-500 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span className="font-semibold">Pinned Message</span>
          </div>
          <p className="text-white">{pinnedMessage.content}</p>
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex flex-col ${
              message.userId === profile.id ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.userId === profile.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#1a222e] text-white'
              }`}
            >
              <div className="text-sm text-gray-400 mb-1">
                {message.userName}
              </div>
              <div className="break-words">{message.content}</div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
            {isManager && !message.isPinned && (
              <button
                onClick={() => {
                  setSelectedMessage(message);
                  setShowPinModal(true);
                }}
                className="text-xs text-gray-400 hover:text-indigo-400 mt-1"
              >
                Pin Message
              </button>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-[#1a222e] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Send
        </button>
      </form>

      {/* Pin Message Modal */}
      {showPinModal && selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-[#1a222e] rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Pin Message</h2>
            <p className="text-gray-400 mb-4">
              Are you sure you want to pin this message? It will be displayed at the top of the chat.
            </p>
            <div className="bg-[#111827] rounded-lg p-3 mb-4">
              <p className="text-white">{selectedMessage.content}</p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowPinModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePinMessage(selectedMessage.id)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
              >
                Pin Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ChatRoom.propTypes = {
  clubId: PropTypes.string.isRequired
}; 