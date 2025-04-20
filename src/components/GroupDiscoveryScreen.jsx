import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinGroup, hasJoinedGroup, getUserPublicKey, fetchGroupMetadataByNaddr } from '../utils/nostrClient';
import { nip19 } from 'nostr-tools';

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

const GroupDiscoveryScreen = () => {
  console.log("GroupDiscoveryScreen component rendering");
  const navigate = useNavigate();
  const [groupsWithMetadata, setGroupsWithMetadata] = useState([]);
  const [joinedGroups, setJoinedGroups] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupsLoading, setGroupsLoading] = useState({});

  // Fetch group metadata on component mount
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Initialize loading state for each group
        const loadingState = {};
        FEATURED_GROUPS.forEach(group => {
          loadingState[group.naddr] = true;
        });
        setGroupsLoading(loadingState);
        
        // Fetch metadata for each group
        const groupsPromises = FEATURED_GROUPS.map(async (group) => {
          try {
            console.log(`Fetching metadata for group with naddr: ${group.naddr}`);
            
            // First try with the standard fetchGroupMetadataByNaddr
            try {
              const metadata = await fetchGroupMetadataByNaddr(group.naddr);
              if (metadata) {
                console.log(`Successfully fetched metadata using standard method for ${group.naddr}`);
                
                // Update loading state for this group
                setGroupsLoading(prev => ({...prev, [group.naddr]: false}));
                
                return {
                  ...group,
                  metadata
                };
              }
            } catch (error) {
              console.error("Standard method error:", error);
              console.log(`Standard fetch method failed for ${group.naddr}, trying WebSocket approach`);
            }
            
            // If standard method fails, try direct WebSocket approach
            try {
              const directMetadata = await fetchGroupMetadataDirectWS(group.naddr, group.relay);
              console.log(`Successfully fetched metadata using WebSocket method for ${group.naddr}`);
              
              // Update loading state for this group
              setGroupsLoading(prev => ({...prev, [group.naddr]: false}));
              
              return {
                ...group,
                metadata: directMetadata
              };
            } catch (wsError) {
              console.error(`WebSocket fetch also failed for ${group.naddr}:`, wsError);
              throw wsError; // Re-throw for outer catch
            }
          } catch (err) {
            console.error(`Error fetching metadata for ${group.naddr}:`, err);
            
            // Update loading state for this group
            setGroupsLoading(prev => ({...prev, [group.naddr]: false}));
            
            // Return group with error flag instead of metadata
            return {
              ...group,
              hasError: true,
              errorMessage: err.message || 'Failed to fetch group data'
            };
          }
        });
        
        const fetchedGroups = await Promise.all(groupsPromises);
        console.log("All groups processed:", fetchedGroups);
        setGroupsWithMetadata(fetchedGroups);
        
        // Check join status for each group
        checkJoinStatus();
      } catch (err) {
        console.error("Error in fetchGroups:", err);
        setError("Failed to load groups. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGroups();
  }, []);

  // Check if user has joined each group
  const checkJoinStatus = async () => {
    try {
    const pubkey = await getUserPublicKey();
      if (!pubkey) {
        console.log("No pubkey available, can't check join status");
        return;
      }

      const statusMap = {};
      // Check join status for each group
    for (const group of FEATURED_GROUPS) {
        try {
          statusMap[group.naddr] = await hasJoinedGroup(group.naddr);
        } catch (innerError) {
          console.error(`Error checking join status for group:`, innerError);
          statusMap[group.naddr] = false; // Assume not joined if error
        }
      }
      setJoinedGroups(statusMap);
    } catch (error) {
      console.error("Error checking join status:", error);
    }
  };

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
  const handleJoinGroup = async (group) => {
    try {
    const pubkey = await getUserPublicKey();
    if (!pubkey) {
        alert("Authentication Required: Please connect your Nostr key in Settings to join groups.");
      return;
    }

    setIsLoading(true);
      console.log(`Joining group with naddr: ${group.naddr}`);
      
      try {
        // Call the joinGroup function and wait for result
        await joinGroup(group.naddr);
        
        // Update local join status on success
        setJoinedGroups(prev => ({
          ...prev,
          [group.naddr]: true
        }));
        
        const groupName = group.metadata?.metadata?.name || 'the group';
        alert(`Success: You've joined ${groupName}!`);
      } catch (joinError) {
        console.error("Error joining group:", joinError);
        alert(`Error: ${joinError.message || "Failed to join the group. Please try again."}`);
        throw joinError; // Re-throw to be caught by outer catch
      }
    } catch (error) {
      console.error("Error in handleJoinGroup:", error);
    } finally {
      setIsLoading(false);
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
        <h1 className="text-2xl font-bold text-white mb-2">Teams</h1>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-20">
      <h1 className="text-2xl font-bold mb-6 text-center">Teams</h1>
      
      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}
      
      {/* Render each group card */}
      {groupsWithMetadata.map((group, index) => {
        // Check if the group is still loading
        if (groupsLoading[group.naddr]) {
          return (
            <div key={index} className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-400">Loading group data...</span>
              </div>
            </div>
          );
        }
        
        // Check if there was an error loading this group
        if (group.hasError) {
          return (
            <div key={index} className="bg-gray-800 rounded-lg p-4 mb-4 border border-red-800">
              <h2 className="text-xl font-bold text-white mb-2">Group Error</h2>
              <p className="text-red-400 mb-2">{group.errorMessage || "Failed to load group data"}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-3 py-1 bg-gray-700 text-gray-300 rounded-md text-sm hover:bg-gray-600"
              >
                Retry
              </button>
            </div>
          );
        }
        
        // Extract metadata for display
        const metadata = group.metadata?.metadata || group.metadata || {};
        const name = metadata.name || 'Unnamed Group';
        const about = metadata.about || 'No description available';
        
        // Parse tags from about or use empty array
        let tags = [];
        if (about) {
          const hashtagMatches = about.match(/#[a-zA-Z0-9_]+/g);
          if (hashtagMatches) {
            tags = hashtagMatches.map(tag => tag.substring(1)); // Remove # prefix
          }
        }
        
        return (
          <div 
          key={index} 
            className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700 cursor-pointer hover:bg-gray-750"
            onClick={() => handleGroupPress(group)}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center">
                <h2 className="text-xl font-bold text-white">{name}</h2>
              </div>
              <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded-full">
                Nostr Group
              </span>
            </div>
            
            <p className="text-gray-300 mb-4">{about}</p>
            
            {renderTags(tags)}
            
            <div className="border-t border-gray-700 pt-3 mt-1">
              <button 
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering the parent's onClick
                  handleJoinGroup(group);
                }}
              disabled={isLoading || joinedGroups[group.naddr]}
                className={`px-4 py-2 rounded-md bg-gray-700 float-right
                  ${(isLoading || joinedGroups[group.naddr]) 
                    ? 'opacity-60 cursor-not-allowed text-gray-400' 
                    : 'text-blue-400 hover:bg-gray-600'}`}
              >
                {joinedGroups[group.naddr] 
                  ? "Joined ✓" 
                  : isLoading 
                    ? "Joining..." 
                    : "Join Group"}
              </button>
            </div>
          </div>
        );
      })}
      
      {groupsWithMetadata.length === 0 && !isLoading && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-center text-gray-400 py-8">
            No groups available. Please check your network connection and try again.
          </p>
          <div className="flex justify-center">
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDiscoveryScreen; 