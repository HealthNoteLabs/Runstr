import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { parseNaddr, subscribe } from '../utils/nostrClient';
import { useGroups } from '../contexts/GroupsContext';
import { useNostr } from '../contexts/NostrContext';
import '../components/RunClub.css';

console.log("TeamDetail component file is loading");

export default function TeamDetail() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { publicKey } = useNostr();
  const { 
    getGroupMetadata, 
    sendGroupMessage, 
    checkMembership,
    membershipStatus,
    pinMessage,
    unpinMessage,
    getPinnedMessages
  } = useGroups();
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupData, setGroupData] = useState(null);
  const [groupMetadata, setGroupMetadata] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [loadingPinned, setLoadingPinned] = useState(false);
  const [pinnedOperation, setPinnedOperation] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Refs
  const subscriptionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Load group data and setup subscription
  useEffect(() => {
    const loadGroupData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Decode URL parameter
        const decodedNaddr = decodeURIComponent(teamId);
        console.log("Decoded naddr:", decodedNaddr);
        
        // Parse naddr to get group components
        const groupInfo = parseNaddr(decodedNaddr);
        if (!groupInfo) {
          throw new Error("Invalid group address");
        }
        
        // Fetch group metadata
        const metadata = await getGroupMetadata(decodedNaddr);
        if (!metadata) {
          throw new Error("Failed to fetch group metadata");
        }
        
        // Parse content if it's a string
        let parsedContent = metadata.content;
        if (typeof parsedContent === 'string') {
          try {
            parsedContent = JSON.parse(parsedContent);
          } catch (err) {
            console.error("Error parsing group metadata content:", err);
          }
        }
        
        // Set group data
        setGroupData(groupInfo);
        setGroupMetadata({
          ...metadata,
          content: parsedContent
        });
        
        // Check if user is a member of this group
        if (publicKey) {
          const memberStatus = await checkMembership(decodedNaddr);
          setIsMember(memberStatus);
        }
        
        // Setup subscription to real-time messages
        setupSubscription(groupInfo);
        
        // Load pinned messages with the Nostr-native approach
        await loadPinnedMessages(decodedNaddr);
        
      } catch (err) {
        console.error("Error loading group:", err);
        setError(`Failed to load group: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadGroupData();
    
    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.close();
      }
    };
  }, [teamId, getGroupMetadata, publicKey, checkMembership]);

  // Load pinned messages
  const loadPinnedMessages = async (naddr) => {
    if (!publicKey) return;
    
    try {
      setLoadingPinned(true);
      const pinned = await getPinnedMessages(naddr);
      setPinnedMessages(pinned || []);
    } catch (err) {
      console.error("Error loading pinned messages:", err);
    } finally {
      setLoadingPinned(false);
    }
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Setup subscription to messages
  const setupSubscription = (groupData) => {
    console.log("Setting up subscription for group:", groupData);
    
    // Clean up any existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.close();
    }
    
    // Extract the actual group ID from the compound identifier
    // Format is kind:pubkey:identifier, we need just the identifier for NIP-29 'h' tag
    const groupIdentifier = `${groupData.kind}:${groupData.pubkey}:${groupData.identifier}`;
    const groupIdParts = groupIdentifier.split(':');
    const actualGroupId = groupIdParts.length === 3 ? groupIdParts[2] : groupIdentifier;
    
    // Format the filter for subscription - NIP-29 uses 'h' tag
    const filter = {
      '#h': [actualGroupId], // NIP-29 uses h tag with group_id
      since: Math.floor(Date.now() / 1000) - 10 // Only get messages from 10 seconds ago
    };
    
    console.log("Subscription filter:", filter);
    
    try {
      // Subscribe to new messages
      const sub = subscribe(filter);
      
      if (sub) {
        console.log("Subscription created successfully");
        
        // Handle incoming events
        sub.on('event', (event) => {
          console.log('New message received:', event);
          
          // Check if we already have this message to avoid duplicates
          if (!messages.some(msg => msg.id === event.id)) {
            setMessages((prevMessages) => [...prevMessages, event]);
          }
        });
        
        // Store the subscription for cleanup
        subscriptionRef.current = sub;
      } else {
        console.warn("Failed to create subscription - subscribe returned null/undefined");
      }
    } catch (error) {
      console.error('Error setting up subscription:', error);
    }
  };

  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageText.trim() || !groupData || !publicKey) {
      return;
    }
    
    setIsSending(true);
    
    try {
      const result = await sendGroupMessage(teamId, messageText.trim());
      
      if (result) {
        // Clear input field after successful send
        setMessageText('');
      } else {
        setError("Failed to send message. Please try again.");
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setError(`Failed to send message: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle pinning a message
  const handlePinMessage = async (message) => {
    if (!publicKey || !teamId) return;
    
    try {
      setPinnedOperation({ type: 'pinning', messageId: message.id });
      
      const result = await pinMessage(message, teamId);
      
      if (result) {
        // Refresh pinned messages to get the updated list from Nostr
        await loadPinnedMessages(teamId);
      }
    } catch (err) {
      console.error("Error pinning message:", err);
      setError(`Failed to pin message: ${err.message}`);
    } finally {
      setPinnedOperation(null);
    }
  };

  // Handle unpinning a message
  const handleUnpinMessage = async (messageId) => {
    if (!publicKey || !teamId) return;
    
    try {
      setPinnedOperation({ type: 'unpinning', messageId });
      
      const result = await unpinMessage(messageId, teamId);
      
      if (result) {
        // Refresh pinned messages to get the updated list from Nostr
        await loadPinnedMessages(teamId);
      }
    } catch (err) {
      console.error("Error unpinning message:", err);
      setError(`Failed to unpin message: ${err.message}`);
    } finally {
      setPinnedOperation(null);
    }
  };

  // Go back to the groups list
  const goBack = () => {
    navigate('/teams');
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  // If user is not authenticated with Nostr, show a warning
  if (!publicKey) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="flex items-center mb-4">
          <button 
            onClick={goBack}
            className="text-gray-400 hover:text-white"
          >
            &larr; Back to Clubs
          </button>
        </div>
        
        <div className="bg-yellow-900/50 p-4 rounded-lg">
          <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-gray-300 mb-4">
            You need to connect your Nostr account to view and participate in running clubs.
          </p>
          <button 
            onClick={() => navigate('/settings')}
            className="px-4 py-2 bg-blue-700 text-white rounded-md"
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="flex items-center mb-4">
          <button 
            onClick={goBack}
            className="text-gray-400 hover:text-white"
          >
            &larr; Back to Clubs
          </button>
        </div>
        
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="flex items-center mb-4">
          <button 
            onClick={goBack}
            className="text-gray-400 hover:text-white"
          >
            &larr; Back to Clubs
          </button>
        </div>
        
        <div className="bg-red-900/50 p-4 rounded-lg">
          <p className="text-white">{error}</p>
          <button 
            onClick={() => setError(null)} 
            className="mt-2 px-4 py-2 bg-red-800 text-white rounded-md"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Show group not found
  if (!groupData || !groupMetadata) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="flex items-center mb-4">
          <button 
            onClick={goBack}
            className="text-gray-400 hover:text-white"
          >
            &larr; Back to Clubs
          </button>
        </div>
        
        <div className="bg-red-900/50 p-4 rounded-lg">
          <h2 className="text-xl font-bold text-white mb-2">Group Not Found</h2>
          <p className="text-gray-300">
            The running club you're looking for could not be found.
          </p>
        </div>
      </div>
    );
  }

  // Extract data from metadata
  const content = groupMetadata.content || {};
  const name = content.name || "Unnamed Club";
  const about = content.about || "No description available";
  const picture = content.picture || null;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center">
          <button 
            onClick={goBack}
            className="text-gray-400 hover:text-white mr-2"
          >
            &larr;
          </button>
          
          {picture && (
            <div className="w-10 h-10 mr-3">
              <img 
                src={picture} 
                alt={name} 
                className="w-full h-full object-cover rounded-full"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/icons/runclub-placeholder.png';
                }}
              />
            </div>
          )}
          
          <div>
            <h1 className="text-xl font-bold text-white">{name}</h1>
            <p className="text-sm text-gray-400">{about}</p>
          </div>
        </div>
      </div>
      
      {/* Membership Notice */}
      {!isMember && (
        <div className="bg-yellow-900/30 p-3 text-center">
          <p className="text-yellow-400 text-sm">
            You are not a member of this club. Some features may be limited.
          </p>
        </div>
      )}
      
      {/* Pinned Messages */}
      {loadingPinned ? (
        <div className="bg-gray-800/60 p-3 border-b border-gray-800 text-center">
          <span className="text-sm text-gray-400">Loading pinned messages...</span>
        </div>
      ) : pinnedMessages.length > 0 && (
        <div className="bg-gray-800/60 p-3 border-b border-gray-800">
          <h3 className="text-sm text-gray-400 mb-2">Pinned Messages</h3>
          <div className="max-h-32 overflow-y-auto">
            {pinnedMessages.map((message) => (
              <div key={message.id} className="flex items-start mb-2 p-2 rounded bg-gray-800">
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    <span className="text-xs text-blue-400">
                      {message.pubkey.substring(0, 8)}...
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {formatTimestamp(message.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300">{message.content}</p>
                </div>
                {pinnedOperation && pinnedOperation.messageId === message.id ? (
                  <span className="text-xs text-gray-500 ml-2">
                    Working...
                  </span>
                ) : (
                  <button 
                    onClick={() => handleUnpinMessage(message.id)}
                    className="text-xs text-gray-500 hover:text-red-400 ml-2"
                  >
                    Unpin
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: '60vh' }}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No messages yet. Be the first to send a message!</p>
          </div>
        ) : (
          messages
            .sort((a, b) => a.created_at - b.created_at)
            .map((message) => {
              const isPinned = pinnedMessages.some(pinned => pinned.id === message.id);
              const isCurrentUser = message.pubkey === publicKey;
              const isPinningThisMessage = pinnedOperation && pinnedOperation.messageId === message.id;
              
              return (
                <div 
                  key={message.id} 
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-3/4 p-3 rounded-lg ${
                      isCurrentUser 
                        ? 'bg-blue-800 text-white' 
                        : 'bg-gray-800 text-gray-300'
                    } ${isPinned ? 'border border-yellow-600' : ''}`}
                  >
                    <div className="flex items-center mb-1 text-xs">
                      <span className={isCurrentUser ? "text-blue-300" : "text-blue-400"}>
                        {message.pubkey.substring(0, 8)}...
                      </span>
                      <span className="text-gray-500 ml-2">
                        {formatTimestamp(message.created_at)}
                      </span>
                      
                      {isPinningThisMessage ? (
                        <span className="ml-2 text-yellow-500">
                          {pinnedOperation.type === 'pinning' ? 'Pinning...' : 'Unpinning...'}
                        </span>
                      ) : !isPinned ? (
                        <button 
                          onClick={() => handlePinMessage(message)}
                          className="ml-2 text-gray-500 hover:text-yellow-400"
                        >
                          Pin
                        </button>
                      ) : null}
                    </div>
                    <p>{message.content}</p>
                  </div>
                </div>
              );
            })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message Input */}
      <div className="p-4 border-t border-gray-800">
        <form onSubmit={handleSendMessage} className="flex items-center">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-l-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isSending || !isMember}
          />
          <button
            type="submit"
            className={`px-4 py-2 rounded-r-lg ${
              isSending || !isMember
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-700 text-white hover:bg-blue-600'
            }`}
            disabled={isSending || !isMember}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
} 