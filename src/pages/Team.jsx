import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { NostrContext } from '../contexts/NostrContext';
import { 
  initializeNostr, 
  createAndPublishEvent as createEvent,
  fetchEvents,
  subscribe,
} from '../utils/nostrClient';
import '../components/RunClub.css';

// Constants for group kinds
const GROUP_KINDS = {
  CHANNEL_CREATION: 40,
  CHANNEL_METADATA: 41,
  CHANNEL_MESSAGE: 42,
  CHANNEL_HIDE_MESSAGE: 43,
  CHANNEL_MUTE_USER: 44,
  CHANNEL_INVITE: 45,
};

// Helper functions for channels
const createChannel = async (metadata) => {
  return createEvent({
    kind: GROUP_KINDS.CHANNEL_CREATION,
    content: JSON.stringify(metadata),
    tags: []
  });
};

const sendChannelMessage = async (channelId, content) => {
  return createEvent({
    kind: GROUP_KINDS.CHANNEL_MESSAGE,
    content,
    tags: [['e', channelId, '', 'root']]
  });
};

const fetchChannelMessages = async (channelId) => {
  return fetchEvents({
    kinds: [GROUP_KINDS.CHANNEL_MESSAGE],
    '#e': [channelId],
    limit: 100
  });
};

const searchChannels = async (query) => {
  const results = await fetchEvents({
    kinds: [GROUP_KINDS.CHANNEL_CREATION],
    limit: 50
  });
  
  if (!query) return results;
  
  // Filter by query if provided
  return results.filter(event => {
    try {
      const metadata = JSON.parse(event.content);
      return metadata.name.toLowerCase().includes(query.toLowerCase());
    } catch {
      return false;
    }
  });
};

const hideChannelMessage = async (messageId) => {
  return createEvent({
    kind: GROUP_KINDS.CHANNEL_HIDE_MESSAGE,
    content: '',
    tags: [['e', messageId]]
  });
};

const muteChannelUser = async (userPubkey) => {
  return createEvent({
    kind: GROUP_KINDS.CHANNEL_MUTE_USER,
    content: '',
    tags: [['p', userPubkey]]
  });
};

const getHiddenMessages = async () => {
  return fetchEvents({
    kinds: [GROUP_KINDS.CHANNEL_HIDE_MESSAGE],
    limit: 100
  });
};

const getMutedUsers = async () => {
  return fetchEvents({
    kinds: [GROUP_KINDS.CHANNEL_MUTE_USER],
    limit: 100
  });
};

const sendChannelInvite = async (channelId, recipientPubkey) => {
  return createEvent({
    kind: GROUP_KINDS.CHANNEL_INVITE,
    content: '',
    tags: [
      ['e', channelId, '', 'root'],
      ['p', recipientPubkey]
    ]
  });
};

export const Team = () => {
  const { teamId } = useParams();
  const { pubkey } = useContext(NostrContext);
  const messagesContainerRef = useRef(null);
  const subscriptionsRef = useRef([]);
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('myTeams'); // 'myTeams', 'create', 'join', 'teamProfile'
  const [myTeams, setMyTeams] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [profiles, setProfiles] = useState(new Map());
  const [subscribedChannels, setSubscribedChannels] = useState(new Set());
  const [hasNewMessages, setHasNewMessages] = useState({});
  const [hiddenMessages, setHiddenMessages] = useState(new Map());
  const [mutedUsers, setMutedUsers] = useState(new Map());
  
  // New team form data
  const [newTeamData, setNewTeamData] = useState({
    name: '',
    description: '',
    picture: '',
    isPublic: true
  });

  // State for invite form
  const [inviteData, setInviteData] = useState({
    pubkey: '',
    sending: false,
    success: false,
    error: null
  });

  // Load hidden messages and muted users
  const loadModeration = useCallback(async () => {
    if (!pubkey) return;
    
    try {
      const hidden = await getHiddenMessages();
      const muted = await getMutedUsers();
      
      setHiddenMessages(hidden);
      setMutedUsers(muted);
    } catch (err) {
      console.error('Error loading moderation data:', err);
    }
  }, [pubkey]);

  // Scroll to bottom of messages when new ones arrive
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Subscribe to messages from a channel
  const subscribeToChannelMessages = useCallback((channelId) => {
    if (!channelId || subscribedChannels.has(channelId)) return null;

    // Add to subscribed channels
    setSubscribedChannels(prevChannels => new Set([...prevChannels, channelId]));

    // Create the subscription filter
    const filter = {
      kinds: [GROUP_KINDS.CHANNEL_MESSAGE],
      '#e': [channelId],
      limit: 50
    };

    // Subscribe to messages
    const subscription = subscribe(filter);
    
    subscription.on('event', (event) => {
      // Skip messages from muted users
      if (mutedUsers.has(event.pubkey)) return;
      
      // Skip hidden messages
      if (hiddenMessages.has(event.id)) return;
      
      setMessages(prevMessages => {
        const isNewMessage = !prevMessages.some(msg => msg.id === event.id);
        if (isNewMessage) {
          // Get author profile if needed
          fetchUserProfile(event.pubkey);
          
          // If not viewing this channel, mark as having new messages
          if (currentTeam && currentTeam.id !== channelId) {
            setHasNewMessages(prev => ({
              ...prev,
              [channelId]: true
            }));
          }
          
          return [...prevMessages, event].sort((a, b) => a.created_at - b.created_at);
        }
        return prevMessages;
      });
    });

    // Store subscription for cleanup
    subscriptionsRef.current.push(subscription);
    
    return subscription;
  }, [subscribedChannels, currentTeam, mutedUsers, hiddenMessages]);

  // Hide a message
  const hideMessage = async (messageId) => {
    if (!pubkey || !messageId) return;
    
    try {
      await hideChannelMessage(messageId);
      
      // Update local state
      setHiddenMessages(prevHidden => {
        const newHidden = new Map(prevHidden);
        newHidden.set(messageId, { reason: "Hidden by user" });
        return newHidden;
      });
      
      // Filter out the hidden message
      setMessages(prevMessages => 
        prevMessages.filter(message => message.id !== messageId)
      );
      
    } catch (err) {
      console.error('Error hiding message:', err);
      setError('Failed to hide message. Please try again.');
    }
  };
  
  // Mute a user
  const muteUser = async (userPubkey) => {
    if (!pubkey || !userPubkey) return;
    
    try {
      await muteChannelUser(userPubkey);
      
      // Update local state
      setMutedUsers(prevMuted => {
        const newMuted = new Map(prevMuted);
        newMuted.set(userPubkey, { reason: "Muted by user" });
        return newMuted;
      });
      
      // Filter out messages from muted user
      setMessages(prevMessages => 
        prevMessages.filter(message => message.pubkey !== userPubkey)
      );
      
    } catch (err) {
      console.error('Error muting user:', err);
      setError('Failed to mute user. Please try again.');
    }
  };

  // Load user profile
  const fetchUserProfile = useCallback(async (userPubkey) => {
    if (!userPubkey || !profiles.has(userPubkey)) return;

    try {
      const profileEvents = await fetchEvents({
        kinds: [0],
        authors: [userPubkey],
        limit: 1
      });

      if (profileEvents.size > 0) {
        const profileEvent = Array.from(profileEvents)[0];
        let profile;
        
        try {
          profile = JSON.parse(profileEvent.content);
        } catch (_) {
          profile = { name: 'Unknown' };
        }
        
        setProfiles(prevProfiles => new Map(prevProfiles).set(userPubkey, profile));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, [profiles]);

  // Initialize
  useEffect(() => {
    const setup = async () => {
      try {
        setLoading(true);
        
        // Initialize Nostr
        if (!await initializeNostr()) {
          setError('Failed to initialize Nostr connection');
          setLoading(false);
          return;
        }
        
        // Load moderation data
        await loadModeration();
        
        // Load user's teams/channels
        if (pubkey) {
          await loadMyChannels();
        }
        
        // If teamId is provided in URL, open that team
        if (teamId) {
          await openTeam(teamId);
          setActiveTab('teamProfile');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error setting up team component:', err);
        setError('Failed to load teams. Please try again later.');
        setLoading(false);
      }
    };
    
    setup();
    
    // Cleanup subscriptions
    return () => {
      subscriptionsRef.current.forEach(subscription => {
        if (subscription && typeof subscription.stop === 'function') {
          subscription.stop();
        }
      });
      subscriptionsRef.current = [];
    };
  }, [teamId, pubkey, loadModeration]);

  // Load channels the user has participated in
  const loadMyChannels = async () => {
    try {
      if (!pubkey) {
        setMyTeams([]);
        return;
      }

      // Fetch user's messages in channels
      const userMessageFilter = {
        kinds: [GROUP_KINDS.CHANNEL_MESSAGE],
        authors: [pubkey],
        limit: 100
      };
      
      const userMessages = await fetchEvents(userMessageFilter);
      
      if (userMessages.size === 0) {
        setMyTeams([]);
        return;
      }
      
      // Fetch channels the user has participated in
      const channelIds = Array.from(userMessages).map(msg => {
        const rootTag = msg.tags.find(tag => tag[0] === 'e' && tag[3] === 'root');
        return rootTag ? rootTag[1] : null;
      }).filter(Boolean);
      
      const channelFilter = {
        kinds: [GROUP_KINDS.CHANNEL_METADATA],
        ids: channelIds,
        limit: 20
      };
      
      const channelEvents = await fetchEvents(channelFilter);
      
      // Process channel data
      const channels = Array.from(channelEvents).map(event => {
        let name, about, picture;
        
        // Try to get metadata from content first (per NIP-28)
        try {
          const metadata = JSON.parse(event.content);
          name = metadata.name;
          about = metadata.about;
          picture = metadata.picture;
        } catch (e) {
          // Fallback to tags if content is not valid JSON
          name = event.tags.find(tag => tag[0] === 'name')?.[1] || 'Unnamed Channel';
          about = event.tags.find(tag => tag[0] === 'about')?.[1] || '';
          picture = event.tags.find(tag => tag[0] === 'picture')?.[1] || '';
        }
        
        return {
          id: event.id,
          name: name || 'Unnamed Channel',
          description: about || '',
          picture: picture || '',
          owner: event.pubkey,
          created_at: event.created_at
        };
      });
      
      setMyTeams(channels);
      
      // Subscribe to messages from all channels
      channels.forEach(channel => {
        subscribeToChannelMessages(channel.id);
      });
    } catch (error) {
      console.error('Error loading user channels:', error);
      setError('Failed to load your channels. Please try again later.');
    }
  };

  // Open team/channel and load messages
  const openTeam = async (teamId) => {
    if (!teamId) {
      setError('Invalid channel ID');
      return;
    }

    try {
      // First, fetch the team metadata
      const channelFilter = {
        kinds: [GROUP_KINDS.CHANNEL_METADATA],
        ids: [teamId],
        limit: 1
      };
      
      const channelEvents = await fetchEvents(channelFilter);
      
      if (channelEvents.size === 0) {
        setError('Channel not found');
        return;
      }
      
      const channelEvent = Array.from(channelEvents)[0];
      
      // Process channel data
      let name, about, picture;
      
      // Try to get metadata from content first (per NIP-28)
      try {
        const metadata = JSON.parse(channelEvent.content);
        name = metadata.name;
        about = metadata.about;
        picture = metadata.picture;
      } catch (_) {
        // Fallback to tags if content is not valid JSON
        name = channelEvent.tags.find(tag => tag[0] === 'name')?.[1] || 'Unnamed Channel';
        about = channelEvent.tags.find(tag => tag[0] === 'about')?.[1] || '';
        picture = channelEvent.tags.find(tag => tag[0] === 'picture')?.[1] || '';
      }
      
      const channel = {
        id: channelEvent.id,
        name: name || 'Unnamed Channel',
        description: about || '',
        picture: picture || '',
        owner: channelEvent.pubkey,
        created_at: channelEvent.created_at
      };
      
      setCurrentTeam(channel);
      
      // Load messages
      const channelMessages = await fetchChannelMessages(teamId);
      
      // Filter out messages from muted users and hidden messages
      const filteredMessages = channelMessages.filter(msg => 
        !mutedUsers.has(msg.pubkey) && !hiddenMessages.has(msg.id)
      );
      
      setMessages(filteredMessages);
      
      // Mark as read
      setHasNewMessages(prev => ({
        ...prev,
        [teamId]: false
      }));
      
      // Load author profiles
      const authors = new Set(filteredMessages.map(msg => msg.pubkey));
      authors.forEach(author => {
        fetchUserProfile(author);
      });
      
      // Subscribe to new messages
      subscribeToChannelMessages(teamId);
      
      // Update my teams list if not already there
      setMyTeams(prev => {
        if (!prev.some(team => team.id === channel.id)) {
          return [...prev, channel];
        }
        return prev;
      });
    } catch (error) {
      console.error('Error opening channel:', error);
      setError('Failed to open channel. Please check your connection and try again later.');
    }
  };

  // Handle team creation
  const createTeam = () => {
    try {
      // Check if logged in with Nostr
      if (!pubkey) {
        setError('You need to log in to create a club. Please click the login button in the top right of the app.');
        return;
      }

      // Basic validation
      if (!newTeamData.name || !newTeamData.description) {
        setError('Please fill out all fields');
        return;
      }

      // Clear any previous errors
      setError('');

      // Automatically append #Runstr to the name if it's not already included
      let finalName = newTeamData.name.trim();
      if (!finalName.includes('#Runstr')) {
        finalName = `${finalName} #Runstr`;
      }

      // Create channel metadata with the finalized name
      const channelMetadata = {
        name: finalName,
        about: newTeamData.description,
        picture: newTeamData.picture || "https://runstr.app/default-club.png"
      };
      
      // Create the channel
      createChannel(channelMetadata)
        .then((channel) => {
          console.log("Club created successfully:", channel);
          // Add newly created channel to local state
          setMyTeams(prevTeams => [...prevTeams, channel]);
          // Reset form
          setNewTeamData({
            name: '',
            description: '',
            picture: ''
          });
          // Switch to the new team
          setActiveTab('teamProfile');
          openTeam(channel.id);
        })
        .catch((err) => {
          console.error('Failed to create channel:', err);
          setError(err.message || 'Failed to create club. Please check your connection and try again.');
        });
    } catch (e) {
      console.error('Error in createTeam:', e);
      setError(e.message || 'An unexpected error occurred.');
    }
  };

  // Send a message to the current team/channel
  const sendMessage = async () => {
    if (!pubkey) {
      setError('You must be logged in to send messages');
      return;
    }

    try {
      if (!messageText.trim() || !currentTeam) return;
      
      // Send message
      await sendChannelMessage(currentTeam.id, messageText);
      
      // Clear message input
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again later.');
    }
  };

  // Search for teams/channels
  const searchTeams = async () => {
    try {
      // Check if logged in
      if (!pubkey) {
        setError('You need to log in to search for clubs. Please click the login button in the top right of the app.');
        return;
      }

      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      
      setLoading(true);
      const results = await searchChannels(searchQuery);
      
      // Process results
      const channels = results.map(event => {
        let name, about, picture;
        
        // Try to get metadata from content first (per NIP-28)
        try {
          const metadata = JSON.parse(event.content);
          name = metadata.name;
          about = metadata.about;
          picture = metadata.picture;
        } catch (_) {
          // Fallback to tags if content is not valid JSON
          name = event.tags.find(tag => tag[0] === 'name')?.[1] || 'Unnamed Channel';
          about = event.tags.find(tag => tag[0] === 'about')?.[1] || '';
          picture = event.tags.find(tag => tag[0] === 'picture')?.[1] || '';
        }
        
        return {
          id: event.id,
          name: name || 'Unnamed Channel',
          description: about || '',
          picture: picture || '',
          owner: event.pubkey,
          created_at: event.created_at
        };
      });
      
      setSearchResults(channels);
      setLoading(false);
    } catch (error) {
      console.error('Error searching teams:', error);
      setLoading(false);
      setError(error.message || 'Failed to search for Run Clubs. Please check your connection and try again later.');
    }
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  // Get user name from profile
  const getUserName = (userPubkey) => {
    if (!userPubkey) return 'Anonymous';
    
    const profile = profiles.get(userPubkey);
    if (profile) {
      return profile.name || profile.username || 'Anonymous';
    }
    return 'Anonymous';
  };

  // Render a team item
  const renderTeamItem = (team) => {
    if (!team || !team.id) return null;
    
    const hasNew = hasNewMessages[team.id];
    
    return (
      <div 
        key={team.id} 
        className={`team-item ${hasNew ? 'has-new-messages' : ''}`}
        onClick={() => {
          openTeam(team.id);
          setActiveTab('teamProfile');
        }}
      >
        {team.picture && (
          <div className="team-avatar">
            <img src={team.picture} alt={team.name} />
          </div>
        )}
        <div className="team-info">
          <h3 className="team-name">{team.name}</h3>
          <p className="team-description">{team.description}</p>
          <p className="team-meta">Created: {formatDate(team.created_at)}</p>
        </div>
        {hasNew && <span className="new-badge">NEW</span>}
      </div>
    );
  };

  // Render the message options
  const MessageOptions = ({ message }) => {
    const [showOptions, setShowOptions] = useState(false);
    
    return (
      <div className="message-options">
        <button 
          className="options-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setShowOptions(!showOptions);
          }}
        >
          •••
        </button>
        
        {showOptions && (
          <div className="options-menu">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMessageText(`@${getUserName(message.pubkey)} `);
                setShowOptions(false);
              }}
            >
              Reply
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                hideMessage(message.id);
                setShowOptions(false);
              }}
            >
              Hide Message
            </button>
            
            {message.pubkey !== pubkey && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  muteUser(message.pubkey);
                  setShowOptions(false);
                }}
              >
                Mute User
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render the "Create Team" tab
  const renderCreateTeamTab = () => (
    <div className="create-team-tab">
      <h2>Create a New Run Club</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-group">
        <label htmlFor="team-name">Run Club Name</label>
        <input
          id="team-name"
          type="text"
          placeholder="Enter club name (we'll add #Runstr for you)"
          value={newTeamData.name}
          onChange={(e) => setNewTeamData({...newTeamData, name: e.target.value})}
        />
        <small className="form-hint">Example: "Chicago Marathon Runners" or "Trail Runners Club"</small>
      </div>
      
      <div className="form-group">
        <label htmlFor="team-description">Description</label>
        <textarea
          id="team-description"
          placeholder="What's this Run Club about?"
          value={newTeamData.description}
          onChange={(e) => setNewTeamData({...newTeamData, description: e.target.value})}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="team-picture">Club Picture URL</label>
        <input
          id="team-picture"
          type="text"
          placeholder="https://example.com/image.jpg"
          value={newTeamData.picture}
          onChange={(e) => setNewTeamData({...newTeamData, picture: e.target.value})}
        />
      </div>
      
      <button 
        className="primary-button create-team-button"
        onClick={createTeam}
        disabled={!pubkey || !newTeamData.name.trim()}
      >
        Create Run Club
      </button>
    </div>
  );

  // Render the "Join Team" tab
  const renderJoinTeamTab = () => (
    <div className="join-team-tab">
      <h2>Find a Run Club</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="search-container">
        <input
          type="text"
          placeholder="Search for Run Clubs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchTeams()}
        />
        <button onClick={searchTeams}>Search</button>
      </div>
      
      {searchResults.length > 0 ? (
        <div className="search-results">
          {searchResults.map(team => renderTeamItem(team))}
        </div>
      ) : (
        searchQuery.trim() && <p className="no-results">No Run Clubs found matching your search.</p>
      )}
    </div>
  );

  // Render the "My Teams" tab
  const renderMyTeamsTab = () => (
    <div className="my-teams-tab">
      <h2>My Run Clubs</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      {!pubkey ? (
        <div className="no-teams">
          <p>Please log in to see your Run Clubs</p>
        </div>
      ) : myTeams.length > 0 ? (
        <div className="teams-list">
          {myTeams.map(team => renderTeamItem(team))}
        </div>
      ) : (
        <div className="no-teams">
          <p>You haven&apos;t joined any Run Clubs yet.</p>
          <div className="cta-buttons">
            <button onClick={() => setActiveTab('create')}>Create a Club</button>
            <button onClick={() => setActiveTab('join')}>Find a Club</button>
          </div>
        </div>
      )}
    </div>
  );

  // Render team profile tab
  const renderTeamProfileTab = () => {
    if (!currentTeam) return null;
    
    return (
      <div className="team-profile-tab">
        <div className="team-header">
          {currentTeam.picture && (
            <img 
              src={currentTeam.picture} 
              alt={currentTeam.name} 
              className="team-picture" 
            />
          )}
          <div className="team-info">
            <h2>{currentTeam.name}</h2>
            <p className="team-description">{currentTeam.description}</p>
          </div>
        </div>
        
        {/* Invite Form */}
        <div className="invite-section">
          <h3>Invite Others to this Run Club</h3>
          <div className="invite-form">
            <input
              type="text"
              placeholder="Enter Nostr public key (npub...)"
              value={inviteData.pubkey}
              onChange={(e) => setInviteData({...inviteData, pubkey: e.target.value, success: false})}
              disabled={inviteData.sending}
              className="invite-input"
            />
            <button 
              onClick={sendInvite}
              disabled={!inviteData.pubkey.trim() || inviteData.sending}
              className="invite-button"
            >
              {inviteData.sending ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
          
          {inviteData.error && (
            <div className="invite-error">{inviteData.error}</div>
          )}
          
          {inviteData.success && (
            <div className="invite-success">Invite sent successfully!</div>
          )}
          
          <div className="invite-tip">
            <p>Tip: You can find someone's public key on their Nostr profile.</p>
            <p>It usually starts with "npub1..." or you can ask them to share it with you.</p>
          </div>
        </div>
        
        <div className="messages-container" ref={messagesContainerRef}>
          {messages.length > 0 ? (
            messages.map(message => (
              <div 
                key={message.id} 
                className={`message ${message.pubkey === pubkey ? 'my-message' : ''}`}
              >
                <div className="message-header">
                  <span className="author-name">{getUserName(message.pubkey)}</span>
                  <span className="message-time">{formatDate(message.created_at)}</span>
                  <MessageOptions message={message} />
                </div>
                <div className="message-content">{message.content}</div>
              </div>
            ))
          ) : (
            <div className="no-messages">
              <p>No messages yet. Be the first to say something!</p>
            </div>
          )}
        </div>
        
        <div className="message-input-container">
          <textarea
            placeholder="Type your message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={!pubkey}
            className="message-input"
          />
          <button 
            onClick={sendMessage}
            disabled={!messageText.trim() || !pubkey}
            className="send-button"
          >
            Send
          </button>
        </div>
      </div>
    );
  };

  // Send invite to a user
  const sendInvite = async () => {
    if (!pubkey || !currentTeam || !inviteData.pubkey.trim()) {
      setInviteData(prev => ({
        ...prev,
        error: 'Please enter a valid Nostr public key to invite'
      }));
      return;
    }

    try {
      setInviteData(prev => ({ ...prev, sending: true, error: null, success: false }));
      
      // Send invite
      await sendChannelInvite(
        currentTeam.id,
        inviteData.pubkey.trim(),
        currentTeam.name
      );
      
      // Update UI
      setInviteData({
        pubkey: '',
        sending: false,
        success: true,
        error: null
      });
    } catch (error) {
      console.error('Error sending invite:', error);
      setInviteData(prev => ({
        ...prev,
        sending: false,
        error: 'Failed to send invite. Please try again later.'
      }));
    }
  };

  // Main render
  return (
    <div className="team-container">
      {loading ? (
        <div className="loading">Loading Run Clubs...</div>
      ) : (
        <>
          <div className="team-tabs">
            <button 
              className={`tab-button ${activeTab === 'myTeams' ? 'active' : ''}`}
              onClick={() => setActiveTab('myTeams')}
            >
              My Clubs
            </button>
            <button 
              className={`tab-button ${activeTab === 'join' ? 'active' : ''}`}
              onClick={() => setActiveTab('join')}
            >
              Find Clubs
            </button>
            <button 
              className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              Create Club
            </button>
            {currentTeam && (
              <button 
                className={`tab-button ${activeTab === 'teamProfile' ? 'active' : ''}`}
                onClick={() => setActiveTab('teamProfile')}
              >
                {currentTeam.name}
              </button>
            )}
          </div>
          
          <div className="tab-content">
            {activeTab === 'myTeams' && renderMyTeamsTab()}
            {activeTab === 'join' && renderJoinTeamTab()}
            {activeTab === 'create' && renderCreateTeamTab()}
            {activeTab === 'teamProfile' && renderTeamProfileTab()}
          </div>
        </>
      )}
    </div>
  );
}; 