import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useRunClub } from './RunClubContext';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { getClubById } = useRunClub();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load messages from localStorage on mount
  useEffect(() => {
    const loadMessages = () => {
      const storedMessages = localStorage.getItem('chatMessages');
      if (storedMessages) {
        try {
          const parsedMessages = JSON.parse(storedMessages);
          setMessages(parsedMessages);
        } catch (error) {
          console.error('Error loading chat messages:', error);
        }
      }
      setLoading(false);
    };

    loadMessages();
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    }
  }, [messages, loading]);

  const sendMessage = (clubId, userId, userName, content) => {
    const newMessage = {
      id: crypto.randomUUID(),
      clubId,
      userId,
      userName,
      content,
      timestamp: new Date().toISOString(),
      isPinned: false
    };

    setMessages(prevMessages => [...prevMessages, newMessage]);
    return newMessage;
  };

  const getClubMessages = (clubId, limit = 50) => {
    return messages
      .filter(message => message.clubId === clubId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-limit);
  };

  const pinMessage = (messageId, clubId, managerId) => {
    const club = getClubById(clubId);
    if (!club || club.managerId !== managerId) return false;

    setMessages(prevMessages =>
      prevMessages.map(message => {
        if (message.clubId === clubId) {
          return {
            ...message,
            isPinned: message.id === messageId
          };
        }
        return message;
      })
    );

    return true;
  };

  const getPinnedMessage = (clubId) => {
    return messages.find(
      message => message.clubId === clubId && message.isPinned
    );
  };

  const value = {
    messages,
    loading,
    sendMessage,
    getClubMessages,
    pinMessage,
    getPinnedMessage
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

ChatProvider.propTypes = {
  children: PropTypes.node.isRequired
}; 