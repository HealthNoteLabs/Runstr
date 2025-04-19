import { useState, useEffect, useRef, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NostrContext } from '../contexts/NostrContext';
import { 
  parseNaddr, 
  fetchGroupMetadataByNaddr, 
  fetchGroupMessages,
  sendGroupMessage,
  subscribe,
  hasJoinedGroup,
  joinGroup,
  leaveGroup
} from '../utils/nostrClient';
import '../components/RunClub.css';

console.log("TeamDetail component file is loading");

export const TeamDetail = () => {
  console.log("TeamDetail component is rendering");
  
  // Change from naddr to teamId to match the route parameter name in AppRoutes.jsx
  const { teamId } = useParams();
  console.log("Team parameter from URL:", teamId);
  
  const navigate = useNavigate();
  const { publicKey } = useContext(NostrContext);
  
  // Local state for the Nostr group
  const [groupInfo, setGroupInfo] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // New membership-related state
  const [isMember, setIsMember] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [membershipError, setMembershipError] = useState(null);
  
  const chatEndRef = useRef(null);
  
  // Track the subscription to clean it up
  const subscriptionRef = useRef(null);

  // Parse naddr and fetch group data on mount
  useEffect(() => {
    console.log("TeamDetail useEffect triggered with parameter:", teamId);
    
    if (!teamId) {
      setError("No group identifier provided");
      setIsLoading(false);
      return;
    }
    
    // Decode the URL parameter in case it was encoded
    const decodedTeamId = decodeURIComponent(teamId);
    console.log("Decoded naddr parameter:", decodedTeamId);
    
    loadGroupData(decodedTeamId).catch(err => {
      console.error("Error in loadGroupData:", err);
      setError(err.message || "Failed to load group data");
    });
    
    // Check membership status
    checkMembershipStatus(decodedTeamId);
    
    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        console.log('Closing subscription');
        subscriptionRef.current.close();
      }
    };
  }, [teamId, publicKey]);
  
  // Scroll to bottom of chat when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Load the group data from the naddr
  const loadGroupData = async (naddrString) => {
    console.log("loadGroupData called for parameter:", naddrString);
    setIsLoading(true);
    setError(null);
    
    try {
      // Parse the naddr
      console.log("Attempting to parse naddr:", naddrString);
      const parsedInfo = parseNaddr(naddrString);
      console.log("Parsed naddr info:", parsedInfo);
      
      if (!parsedInfo) {
        throw new Error(`Invalid group identifier: ${naddrString}`);
      }
      
      setGroupInfo(parsedInfo);
      
      // Fetch group metadata directly using naddr
      console.log("Fetching group metadata");
      let groupMetadata = null;
      
      try {
        // First try with the standard method
        groupMetadata = await fetchGroupMetadataByNaddr(naddrString);
        
        if (!groupMetadata) {
          throw new Error('No metadata returned from relay');
        }
      } catch (fetchError) {
        console.error("Standard metadata fetch failed:", fetchError);
        
        // Create a WebSocket connection to fetch metadata directly
        try {
          const ws = new WebSocket('wss://groups.0xchat.com');
          
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              ws.close();
              reject(new Error('Connection timeout'));
            }, 5000);
            
            ws.onopen = () => {
              // Create filter for the group metadata
              const filter = {
                kinds: [parsedInfo.kind],
                authors: [parsedInfo.pubkey],
                '#d': [parsedInfo.identifier]
              };
              
              // Send subscription request
              ws.send(JSON.stringify(['REQ', 'metadata', filter]));
            };
            
            ws.onmessage = (event) => {
              try {
                const message = JSON.parse(event.data);
                if (message[0] === 'EVENT' && message[2]) {
                  const eventData = message[2];
                  
                  // Parse metadata from content or tags
                  let metadata = {};
                  try {
                    if (eventData.content) {
                      metadata = JSON.parse(eventData.content);
                    }
                  } catch {
                    console.log('Content is not JSON, using tag-based metadata');
                  }
                  
                  // Extract metadata from tags
                  if (eventData.tags) {
                    for (const tag of eventData.tags) {
                      if (tag[0] === 'name' && tag[1]) metadata.name = tag[1];
                      else if (tag[0] === 'about' && tag[1]) metadata.about = tag[1];
                      else if ((tag[0] === 'picture' || tag[0] === 'image') && tag[1]) metadata.picture = tag[1];
                    }
                  }
                  
                  groupMetadata = {
                    id: eventData.id,
                    pubkey: eventData.pubkey,
                    created_at: eventData.created_at,
                    kind: eventData.kind,
                    tags: eventData.tags,
                    metadata
                  };
                  
                  clearTimeout(timeout);
                  ws.close();
                  resolve();
                }
              } catch (error) {
                console.error('Error processing WebSocket message:', error);
              }
            };
            
            ws.onerror = (error) => {
              clearTimeout(timeout);
              ws.close();
              reject(error);
            };
          });
        } catch (wsError) {
          console.error("WebSocket fetch also failed:", wsError);
          throw new Error('Failed to fetch group metadata from all sources');
        }
      }
      
      if (!groupMetadata) {
        throw new Error('Group not found or metadata fetch failed');
      }
      
      console.log("Group metadata received:", groupMetadata);
      setMetadata(groupMetadata);
      
      // Fetch messages
      await loadMessages(parsedInfo);
      
      // Load pinned messages from local storage
      loadPinnedMessages(naddrString);
      
      // Subscribe to new messages
      setupSubscription(parsedInfo);
      
    } catch (error) {
      console.error('Error loading group data:', error);
      setError(error.message || 'Failed to load group data');
      // Set detailed error state for UI
      setMetadata({
        error: true,
        message: error.message,
        groupId: naddrString,
        decodedId: naddrString,
        groupInfo: groupInfo ? `Kind: ${groupInfo.kind}, PubKey: ${groupInfo.pubkey?.substring(0, 8)}...` : 'Not Available'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Setup real-time subscription to new messages
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
  
  // Load messages for the group
  const loadMessages = async (groupData) => {
    console.log("Loading messages for group:", groupData);
    
    try {
      const groupId = `${groupData.kind}:${groupData.pubkey}:${groupData.identifier}`;
      console.log("Fetching messages with group ID:", groupId);
      
      const relays = groupData.relays.length > 0 ? groupData.relays : ['wss://groups.0xchat.com'];
      console.log("Using relays:", relays);
      
      const messages = await fetchGroupMessages(groupId, relays);
      console.log("Received messages:", messages);
      
      setMessages(messages);
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages');
    }
  };
  
  // Load pinned messages from local storage
  const loadPinnedMessages = (naddrString) => {
    try {
      const pinnedStorageKey = `pinned_messages_${naddrString || teamId}`;
      const stored = localStorage.getItem(pinnedStorageKey);
      if (stored) {
        setPinnedMessages(JSON.parse(stored));
      } else {
        setPinnedMessages([]);
      }
    } catch (error) {
      console.error('Error loading pinned messages:', error);
      setPinnedMessages([]);
    }
  };
  
  // Pin a message (store locally)
  const pinMessage = (message, naddrString) => {
    try {
      // Only allow if user is authenticated
      if (!publicKey) {
        setError('You must be authenticated with Nostr to pin messages');
        return;
      }
      
      // Get the properly decoded naddr
      const decodedNaddr = naddrString || decodeURIComponent(teamId);
      
      // Add to pinned messages if not already pinned
      if (!pinnedMessages.some(pinned => pinned.id === message.id)) {
        const updatedPinned = [...pinnedMessages, message];
        setPinnedMessages(updatedPinned);
        
        // Save to local storage
        const pinnedStorageKey = `pinned_messages_${decodedNaddr}`;
        localStorage.setItem(pinnedStorageKey, JSON.stringify(updatedPinned));
      }
    } catch (error) {
      console.error('Error pinning message:', error);
      setError('Failed to pin message');
    }
  };
  
  // Unpin a message
  const unpinMessage = (messageId, naddrString) => {
    try {
      // Only allow if user is authenticated
      if (!publicKey) {
        setError('You must be authenticated with Nostr to unpin messages');
        return;
      }
      
      // Get the properly decoded naddr
      const decodedNaddr = naddrString || decodeURIComponent(teamId);
      
      const updatedPinned = pinnedMessages.filter(message => message.id !== messageId);
      setPinnedMessages(updatedPinned);
      
      // Save to local storage
      const pinnedStorageKey = `pinned_messages_${decodedNaddr}`;
      localStorage.setItem(pinnedStorageKey, JSON.stringify(updatedPinned));
    } catch (error) {
      console.error('Error unpinning message:', error);
      setError('Failed to unpin message');
    }
  };
  
  // Send a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageText.trim() || !groupInfo || !publicKey) {
      return;
    }
    
    setIsSending(true);
    
    try {
      console.log("Sending message to group:", groupInfo);
      const sentMessage = await sendGroupMessage(groupInfo, messageText.trim());
      
      if (sentMessage) {
        console.log("Message sent successfully:", sentMessage);
        setMessageText('');
        // Optimistically add the message to the list
        setMessages(prev => [...prev, sentMessage]);
        // Scroll to bottom after sending
        setTimeout(scrollToBottom, 100);
      } else {
        console.error("sendGroupMessage returned falsy value");
        setError('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };
  
  // Scroll to the bottom of the chat
  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };
  
  // Check if the user is a member of this group
  const checkMembershipStatus = async (naddrString) => {
    if (!publicKey) {
      setIsMember(false);
      return;
    }
    
    try {
      const member = await hasJoinedGroup(naddrString);
      setIsMember(member);
      console.log(`User membership status for ${naddrString}: ${member ? 'Member' : 'Not a member'}`);
    } catch (error) {
      console.error('Error checking membership status:', error);
      setIsMember(false);
    }
  };
  
  // Handle joining a group
  const handleJoinGroup = async () => {
    if (!publicKey) {
      setError('You must be authenticated with Nostr to join groups');
      return;
    }
    
    setIsJoining(true);
    setMembershipError(null);
    
    try {
      const success = await joinGroup(decodeURIComponent(teamId));
      if (success) {
        setIsMember(true);
        console.log('Successfully joined group');
        // Reload messages after joining
        if (groupInfo) {
          await loadMessages(groupInfo);
        }
      } else {
        throw new Error('Failed to join group');
      }
    } catch (error) {
      console.error('Error joining group:', error);
      setMembershipError(`Failed to join: ${error.message}`);
    } finally {
      setIsJoining(false);
    }
  };
  
  // Handle leaving a group
  const handleLeaveGroup = async () => {
    if (!publicKey) {
      setError('You must be authenticated with Nostr to leave groups');
      return;
    }
    
    if (window.confirm('Are you sure you want to leave this group?')) {
      setIsLeaving(true);
      setMembershipError(null);
      
      try {
        const success = await leaveGroup(decodeURIComponent(teamId));
        if (success) {
          setIsMember(false);
          console.log('Successfully left group');
        } else {
          throw new Error('Failed to leave group');
        }
      } catch (error) {
        console.error('Error leaving group:', error);
        setMembershipError(`Failed to leave: ${error.message}`);
      } finally {
        setIsLeaving(false);
      }
    }
  };
  
  // If user is not authenticated with Nostr, show a warning
  if (!publicKey) {
    return (
      <div className="p-4 bg-gray-800 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-white mb-4">Connect with Nostr</h1>
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6">
            <p className="text-yellow-300">
              You need to connect with Nostr to view this running club.
              Please go to settings and connect your Nostr account.
            </p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }
  
  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  // Handle error state
  if (error || (metadata && metadata.error)) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="bg-gray-800 rounded-lg p-6 max-w-lg mx-auto mt-8 border border-red-800">
          <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
          <p className="text-red-400 mb-4">{error || metadata?.message}</p>
          
          {metadata?.error && (
            <div className="space-y-2 text-gray-400 text-sm mb-6">
              <p>Group ID: {metadata.groupId}</p>
              <p>Decoded ID: {metadata.decodedId}</p>
              <p>Metadata: Not Available</p>
              <p>GroupInfo: {metadata.groupInfo}</p>
            </div>
          )}
          
          <div className="flex gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Go Back
            </button>
            <button 
              onClick={() => loadGroupData(teamId)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
  
    return (
    <div className="p-4 bg-gray-800 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Group Header */}
        <div className="flex items-center mb-6">
          <button
            onClick={() => navigate('/teams')}
            className="mr-4 text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          
          <div className="flex items-center flex-1">
            {metadata.metadata?.picture ? (
              <img 
                src={metadata.metadata.picture} 
                alt={metadata.metadata.name} 
                className="w-12 h-12 rounded-full mr-4"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center mr-4">
                <span className="text-white text-xl font-bold">
                  {metadata.metadata?.name?.charAt(0) || '#'}
                </span>
              </div>
            )}
            
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">
                {metadata.metadata?.name || 'Running Club'}
              </h1>
              <p className="text-gray-400 text-sm">
                {metadata.metadata?.about || 'A Nostr running community'}
              </p>
            </div>
            
            {/* Membership controls */}
            <div className="ml-auto">
              {isMember ? (
                <button
                  onClick={handleLeaveGroup}
                  disabled={isLeaving}
                  className="px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {isLeaving ? 'Leaving...' : 'Leave Group'}
                </button>
              ) : (
                <button
                  onClick={handleJoinGroup}
                  disabled={isJoining}
                  className="px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {isJoining ? 'Joining...' : 'Join Group'}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Membership error message */}
        {membershipError && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">{membershipError}</p>
          </div>
        )}
        
        {/* Tabs */}
        <div className="mb-4">
          <div className="flex border-b border-gray-700">
            <button
              className={`tab-button py-2 px-4 relative ${
                activeTab === 'chat' ? 'active text-blue-400' : 'text-gray-400'
              }`}
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
            <button
              className={`tab-button py-2 px-4 relative ${
                activeTab === 'pinned' ? 'active text-blue-400' : 'text-gray-400'
              }`}
              onClick={() => setActiveTab('pinned')}
            >
              Pinned Messages ({pinnedMessages.length})
            </button>
          </div>
        </div>
        
        {/* Message input - Hide if not a member */}
        <div className="tab-content bg-gray-800 rounded-lg">
          {activeTab === 'chat' ? (
            <>
              {/* Chat Messages */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4 h-96 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="flex justify-center items-center h-full">
                    <p className="text-gray-500">
                      {isMember 
                        ? "No messages yet. Start a conversation!" 
                        : "Join this group to participate in the conversation."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div 
                        key={message.id} 
                        className={`p-3 rounded-lg ${
                          message.pubkey === publicKey
                            ? 'bg-blue-900/20 ml-8'
                            : 'bg-gray-700/50 mr-8'
                        }`}
                      >
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-gray-400">
                            {message.pubkey.substring(0, 8)}...
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(message.created_at)}
                          </span>
                        </div>
                        <p className="text-gray-200 break-words">{message.content}</p>
                        
                        {/* Only show pin option for other people's messages */}
                        {message.pubkey !== publicKey && !pinnedMessages.some(pm => pm.id === message.id) && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              pinMessage(message, teamId);
                            }}
                            className="text-xs text-gray-500 mt-1 hover:text-blue-400"
                          >
                            Pin Message
                          </button>
                        )}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>
              
              {/* Message Input - Only show if member */}
              {isMember ? (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg"
                    disabled={isSending}
                  />
                  <button
                    type="submit"
                    disabled={isSending || !messageText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {isSending ? 'Sending...' : 'Send'}
                  </button>
                </form>
              ) : (
                <div className="bg-gray-700/30 rounded-lg p-3 text-center">
                  <p className="text-gray-400">Join this group to send messages</p>
                </div>
              )}
            </>
          ) : (
            /* Pinned Messages Tab */
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4 min-h-[300px]">
              {pinnedMessages.length === 0 ? (
                <div className="flex justify-center items-center h-32">
                  <p className="text-gray-500">No pinned messages yet. Pin important messages for easy reference!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pinnedMessages.map((message) => (
                    <div
                      key={message.id}
                      className="p-3 bg-yellow-900/20 border border-yellow-800/50 rounded-lg"
                    >
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-yellow-400">
                          {message.pubkey.substring(0, 8)}...
                        </span>
                        <div>
                          <span className="text-xs text-yellow-500 mr-2">
                            {formatTimestamp(message.created_at)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              unpinMessage(message.id, teamId);
                            }}
                            className="text-xs text-red-400"
                          >
                            Unpin
                          </button>
                        </div>
                      </div>
                      <p className="text-yellow-100">{message.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamDetail; 