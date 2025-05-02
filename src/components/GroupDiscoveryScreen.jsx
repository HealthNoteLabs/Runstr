import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserPublicKey, fetchGroupMetadataByNaddr } from '../utils/nostrClient';
import { nip19 } from 'nostr-tools';
import { useGroups } from '../contexts/GroupsContext';

console.log("GroupDiscoveryScreen is loading");

// Featured groups with only naddr and relay info (no hardcoded metadata)
const FEATURED_GROUPS = [
  {
    naddr: "naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqsp4vfsnswrxve3rwdmyxgun2vnrx4jnvef5xs6rqcehxu6kgcmrvymkvvtpxuerwwp4xasn2cfhxymnxdpexsergvfhx3jnjce5vyunvg7fw59",
    relay: "wss://groups.0xchat.com"
  },
  {
    naddr: "naddr1qvzqqqyctqpzptvcmkzg2fuxuvltqegc0r4cxkey95jl0sp9teh95azm77mtu9wgqyv8wumn8ghj7emjda6hquewxpuxx6rpwshxxmmd9uq3samnwvaz7tm8wfhh2urn9cc8scmgv96zucm0d5hsqspevfjxxcehx4jrqvnyxejnqcfkxs6rwc3kxa3rxcnrxdjnxctyxgmrqv34xasnscfjvccnswpkvyer2etxxgcngvrzxcerzetxxccxznx86es",
    relay: "wss://groups.0xchat.com"
  }
];

// Direct WebSocket approach for fetching group metadata (similar to test script)
const fetchGroupMetadataDirectWS = (naddrString, relayUrl) => {
  return new Promise((resolve, reject) => {
    try {
      // Parse the naddr to get the filter components
      const decodedData = nip19.decode(naddrString);
      if (!decodedData || !decodedData.data) {
        return reject(new Error("Invalid naddr format"));
      }
      
      const { data } = decodedData;
      
      // Create WebSocket connection
      console.log(`Connecting to relay: ${relayUrl}`);
      const ws = new WebSocket(relayUrl);
      let receivedMetadata = false;
      let timeoutId;
      
      ws.onopen = () => {
        console.log(`Connected to ${relayUrl}, sending metadata request`);
        // Create filter for the group metadata
        const filter = {
          kinds: [data.kind],
          authors: [data.pubkey],
          '#d': [data.identifier]
        };
        
        // Send subscription request
        ws.send(JSON.stringify(['REQ', 'metadata', filter]));
        
        // Set timeout for response
        timeoutId = setTimeout(() => {
          if (!receivedMetadata) {
            console.error('Metadata fetch timeout');
            ws.close();
            reject(new Error('Timeout fetching group metadata'));
          }
        }, 8000);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message[0] === 'EVENT' && message[1] === 'metadata') {
            const eventData = message[2];
            console.log('Received group metadata:', eventData);
            
            receivedMetadata = true;
            clearTimeout(timeoutId);
            
            // Extract metadata from content or tags
            let metadata = {};
            try {
              if (eventData.content) {
                const contentData = JSON.parse(eventData.content);
                metadata = { ...contentData };
              }
            } catch {
              console.log('Content is not JSON, using tag-based metadata');
            }
            
            // Extract metadata from tags
            if (eventData.tags) {
              for (const tag of eventData.tags) {
                if (tag[0] === 'name' && tag[1]) {
                  metadata.name = tag[1];
                } else if (tag[0] === 'about' && tag[1]) {
                  metadata.about = tag[1];
                } else if ((tag[0] === 'picture' || tag[0] === 'image') && tag[1]) {
                  metadata.picture = tag[1];
                }
              }
            }
            
            // Create result object with all necessary data
            const result = {
              id: eventData.id,
              pubkey: eventData.pubkey,
              created_at: eventData.created_at,
              kind: eventData.kind,
              tags: eventData.tags,
              metadata
            };
            
            ws.close();
            resolve(result);
          } else if (message[0] === 'EOSE' && message[1] === 'metadata') {
            // End of stored events, if we haven't received metadata yet
            if (!receivedMetadata) {
              setTimeout(() => {
                if (!receivedMetadata) {
                  console.log('No metadata found for this group');
                  ws.close();
                  reject(new Error('No metadata found for this group'));
                }
              }, 1000); // Wait a bit longer in case metadata comes after EOSE
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(timeoutId);
        ws.close();
        reject(new Error('WebSocket error connecting to relay'));
      };
      
      ws.onclose = () => {
        clearTimeout(timeoutId);
        if (!receivedMetadata) {
          reject(new Error('Connection closed without receiving metadata'));
        }
      };
    } catch (error) {
      console.error('Error in fetchGroupMetadataDirectWS:', error);
      reject(error);
    }
  });
};

export default function GroupDiscoveryScreen() {
  const navigate = useNavigate();
  const { 
    joinGroup, 
    leaveGroup, 
    checkMembership, 
    membershipStatus, 
    membershipInProgress,
    error: groupsError,
    clearError
  } = useGroups();

  const [groupsWithMetadata, setGroupsWithMetadata] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);

  // Fetch metadata for featured groups
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const metadataPromises = FEATURED_GROUPS.map(async (group) => {
          try {
            const metadata = await fetchGroupMetadataByNaddr(group.naddr);
            return {
              ...group,
              metadata: metadata || { content: {} }, // Ensure we have at least an empty content object
              error: null
            };
          } catch (err) {
            console.error(`Error fetching metadata for group ${group.naddr}:`, err);
            return {
              ...group,
              metadata: { content: {} },
              error: `Failed to load group data: ${err.message}`
            };
          }
        });

        const groupsWithData = await Promise.all(metadataPromises);
        setGroupsWithMetadata(groupsWithData);
      } catch (err) {
        console.error("Error fetching group metadata:", err);
        setError("Failed to load running clubs. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, []);

  // Check membership status for each group
  useEffect(() => {
    const checkAllMemberships = async () => {
      if (groupsWithMetadata.length === 0) return;
      
      try {
        for (const group of groupsWithMetadata) {
          await checkMembership(group.naddr);
        }
      } catch (error) {
        console.error("Error checking join status:", error);
      }
    };

    checkAllMemberships();
  }, [groupsWithMetadata, checkMembership]);

  // Navigate to group chat
  const handleGroupPress = (group) => {
    try {
      // Ensure we have a valid naddr
      if (!group || !group.naddr) {
        setError("Invalid group data - missing naddr");
        return;
      }
      
      // Make sure the naddr is properly encoded for URL
      const encodedNaddr = encodeURIComponent(group.naddr);
      console.log(`Navigating to group chat with naddr: ${group.naddr}`);
      console.log(`Encoded naddr for URL: ${encodedNaddr}`);
      
      navigate(`/teams/${encodedNaddr}`);
    } catch (error) {
      console.error("Error navigating to team detail:", error);
      setError("Failed to navigate to team detail. Please try again.");
    }
  };

  // Join a group
  const handleJoinGroup = async (e, group) => {
    e.stopPropagation(); // Prevent triggering the parent's onClick
    
    try {
      const userPublicKey = await getUserPublicKey();
      
      if (!userPublicKey) {
        setError("You must be logged in with Nostr to join a running club");
        return;
      }
      
      const result = await joinGroup(group.naddr);
      
      if (result) {
        // Success notification could be added here
        console.log("Successfully joined group:", group.naddr);
      }
    } catch (error) {
      console.error("Error joining group:", error);
      setError(`Failed to join group: ${error.message}`);
    }
  };

  // Leave a group
  const handleLeaveGroup = async (e, group) => {
    e.stopPropagation(); // Prevent triggering the parent's onClick
    
    try {
      const userPublicKey = await getUserPublicKey();
      
      if (!userPublicKey) {
        setError("You must be logged in with Nostr to leave a running club");
        return;
      }
      
      const result = await leaveGroup(group.naddr);
      
      if (result) {
        // Success notification could be added here
        console.log("Successfully left group:", group.naddr);
      }
    } catch (error) {
      console.error("Error leaving group:", error);
      setError(`Failed to leave group: ${error.message}`);
    }
  };

  // Helper to render tags (if available)
  const renderTags = (tags) => {
    if (!tags || !Array.isArray(tags) || tags.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mb-4">
      {tags.map((tag, index) => (
          <span key={index} className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded-md">
            #{tag}
          </span>
        ))}
      </div>
    );
  };

  // Display loading state for entire screen
  if (isLoading && groupsWithMetadata.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <h1 className="text-2xl font-bold text-white mb-2">Running Clubs</h1>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  // Display error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <h1 className="text-2xl font-bold text-white mb-2">Running Clubs</h1>
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

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <h1 className="text-2xl font-bold text-white mb-2">Running Clubs</h1>
      
      {/* Display errors from Groups context if any */}
      {groupsError && (
        <div className="bg-red-900/50 p-4 mb-4 rounded-lg">
          <p className="text-white">{groupsError}</p>
          <button 
            onClick={clearError} 
            className="mt-2 px-4 py-2 bg-red-800 text-white rounded-md"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Display featured groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groupsWithMetadata.map((group, index) => {
          const metadata = group.metadata || { content: {} };
          const content = typeof metadata.content === 'string' 
            ? JSON.parse(metadata.content) 
            : metadata.content;
          
          const name = content.name || "Unnamed Club";
          const about = content.about || "No description available";
          const groupTags = content.hashtags || [];
          const picture = content.picture || null;
          
          // Get membership status
          const isMember = membershipStatus[group.naddr] || false;
          const isJoining = membershipInProgress[group.naddr] === 'joining';
          const isLeaving = membershipInProgress[group.naddr] === 'leaving';
          
          return (
            <div 
              key={index} 
              onClick={() => handleGroupPress(group)}
              className="bg-gray-800 rounded-lg p-4 cursor-pointer hover:bg-gray-700 transition-colors duration-200"
            >
              <div className="flex items-start mb-4">
                {picture && (
                  <div className="w-16 h-16 mr-4">
                    <img 
                      src={picture} 
                      alt={name} 
                      className="w-full h-full object-cover rounded-md"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/icons/runclub-placeholder.png';
                      }}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white">{name}</h2>
                  {renderTags(groupTags)}
                  <p className="text-gray-400 line-clamp-3">{about}</p>
                </div>
              </div>
              
              {/* Join/Leave Button */}
              {isMember ? (
                <button
                  onClick={(e) => handleLeaveGroup(e, group)}
                  disabled={isLeaving}
                  className={`mt-2 px-4 py-2 ${
                    isLeaving ? 'bg-red-900' : 'bg-red-700'
                  } text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors duration-200`}
                >
                  {isLeaving ? 'Leaving...' : 'Leave Club'}
                </button>
              ) : (
                <button
                  onClick={(e) => handleJoinGroup(e, group)}
                  disabled={isJoining}
                  className={`mt-2 px-4 py-2 ${
                    isJoining ? 'bg-blue-900' : 'bg-blue-700'
                  } text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-200`}
                >
                  {isJoining ? 'Joining...' : 'Join Club'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Coming Soon Modal */}
      {showComingSoonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Coming Soon!</h2>
            <p className="text-gray-400 mb-4">
              The ability to join running clubs is coming soon! Check back later.
            </p>
            <button
              onClick={() => setShowComingSoonModal(false)}
              className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 