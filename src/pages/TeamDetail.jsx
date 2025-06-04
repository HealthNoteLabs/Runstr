import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { NostrContext } from '../contexts/NostrContext.tsx';
import { ndkReadyPromise } from '../lib/ndkSingleton';
import { 
  parseNaddr, 
  isMember, 
  joinGroup, 
  removeMember,
  fetchGroupMetadataByNaddr,
  isGroupAdmin,
} from '../utils/ndkGroups.js';
import { ensureRelays } from '../utils/relays.js';
import { useProfileCache } from '../hooks/useProfileCache.js';
import '../components/RunClub.css';
import { ChatRoom } from '../components/ChatRoom.jsx';

console.log("TeamDetail component file is loading (Simplified Metadata)");

export const TeamDetail = () => {
  console.log("TeamDetail component is rendering (Simplified Metadata)");
  const { teamId: naddrStringFromUrl } = useParams();
  const location = useLocation(); // Get location object
  
  // Extract passed state for display
  const passedState = location.state || {};
  const displayName = passedState.displayName || 'Loading Name...'; // Use passed name
  const displayPicture = passedState.displayPicture || '/default-avatar.png'; // Use passed picture

  // Keep context needed for ChatRoom, member check, etc.
  const { publicKey, ndkReady, relayCount, ndkError: ndkInitError, ndk } = useContext(NostrContext);
  
  // Keep state needed for groupId, relayHints, tabs, members, etc.
  const [groupId, setGroupId] = useState(null);
  const relayHintsRef = useRef([]);
  const [isLoadingData, setIsLoadingData] = useState(true); 
  const [isMemberState, setIsMemberState] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [isProcessingMembership, setIsProcessingMembership] = useState(false);
  const [members, setMembers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const { fetchProfiles } = useProfileCache();
  // Silence unused variable warnings while Members feature is disabled
  // eslint-disable-next-line no-unused-vars
  const _unusedStateDeps = [members, admins];
  void _unusedStateDeps;

  // Define loadGroupMembers *before* the useEffect that uses it as a dependency
  const loadGroupMembers = useCallback(async (currentGroupId, ndkInstance, currentRelayHints) => {
    if (!currentGroupId) return;
    if (!ndkInstance) return; // Simply return if NDK is unavailable, don't set error
    // console.log(`Fetching members for group ${currentGroupId} with hints ${JSON.stringify(currentRelayHints)}`);
    
    ensureRelays(currentRelayHints);
    await new Promise(resolve => setTimeout(resolve, 100));

    const fetchOpts = {};
    
    const adminEvents = await ndkInstance.fetchEvents({ kinds: [39000], '#d': [currentGroupId], limit: 1 }, fetchOpts);
    const memberListEvents = await ndkInstance.fetchEvents({ kinds: [39002], '#d': [currentGroupId] }, fetchOpts);
    
    const memberStatus = new Map();
    
    if (adminEvents.size > 0) {
        const latestAdminEvent = Array.from(adminEvents).sort((a,b) => b.created_at - a.created_at)[0];
        const adminPubkeys = latestAdminEvent.tags.filter(t => t[0] === 'p' && t[2] === 'admin').map(t => t[1]);
        adminPubkeys.forEach(pubkey => {
            if (!memberStatus.has(pubkey) || latestAdminEvent.created_at > (memberStatus.get(pubkey)?.timestamp || 0)) {
                memberStatus.set(pubkey, { status: 'admin', timestamp: latestAdminEvent.created_at });
            }
        });
        setAdmins(adminPubkeys);
    }

    memberListEvents.forEach(event => {
      const pTag = event.tags.find(t => t[0] === 'p');
      if (pTag && pTag[1]) {
        if (memberStatus.has(pTag[1]) && memberStatus.get(pTag[1]).status === 'admin' && event.created_at <= memberStatus.get(pTag[1]).timestamp)
        {
           // Intentionally empty: Admin status takes precedence if newer or same timestamp
        } 
        else if (!memberStatus.has(pTag[1]) || event.created_at > (memberStatus.get(pTag[1])?.timestamp || 0) ) {
          memberStatus.set(pTag[1], { status: 'member', timestamp: event.created_at });
        }
      }
    });

    const currentMembersArray = [];
    memberStatus.forEach((statusInfo, pubkey) => {
      if (statusInfo.status === 'member' || statusInfo.status === 'admin') {
        currentMembersArray.push(pubkey);
      }
    });
    
    // Cannot use groupMetadataEvent here anymore, need pubkey from parsedInfo if needed

    // console.log(`TeamDetail: Found ${currentMembersArray.length} members (including admins) for group ${currentGroupId}`);
    setMembers([...new Set(currentMembersArray)]);
    if (currentMembersArray.length > 0) {
        const fetchedMap = await fetchProfiles([...new Set(currentMembersArray)]);
        if (fetchedMap instanceof Map) {
            // setProfiles(prev => {
               // const newMap = new Map(prev);
               // fetchedMap.forEach((val, key) => newMap.set(key, val));
               // return newMap;
            // });
        }
    }

  }, [fetchProfiles, setAdmins, setMembers, setError]); 

  // Effect to parse naddr and set groupId/relayHints/load pinned messages
  useEffect(() => {
    if (!naddrStringFromUrl) {
      setError("No group identifier provided in URL.");
      setIsLoadingData(false);
      return;
    }
    const decodedNaddr = decodeURIComponent(naddrStringFromUrl);
    // console.log("TeamDetail EarlyParse: Attempting to parse naddr:", decodedNaddr);
    const parsedInfo = parseNaddr(decodedNaddr);
    if (parsedInfo && parsedInfo.rawGroupId) {
      // console.log("TeamDetail EarlyParse: Successfully parsed. rawGroupId:", parsedInfo.rawGroupId, "RelayHints:", parsedInfo.relays);
      setGroupId(parsedInfo.rawGroupId);
      relayHintsRef.current = parsedInfo.relays || [];
      setError(null);
    } else {
      console.error("TeamDetail EarlyParse: Failed to parse naddr or get rawGroupId", parsedInfo);
      setError("Failed to understand group address.");
      setGroupId(null);
      setIsLoadingData(false);
    }
  }, [naddrStringFromUrl]); // Moved loadPinnedMessages call here, removing it from its own effect's dependencies

  // Main useEffect: Wait for NDK, ensure relays, load members/status
  useEffect(() => {
    const naddrForEffect = naddrStringFromUrl;

    if (!groupId || !naddrForEffect) { 
      setIsLoadingData(false); 
      return;
    }

    const executeLoad = async () => {
      setIsLoadingData(true);
      setError(null);

      try {
        const isNdkTrulyReady = await ndkReadyPromise;
        
        if (!isNdkTrulyReady && !ndk.pool.stats().connected) { 
            console.warn("TeamDetail: NDK did not become ready. Member loading/check might fail.");
        }
        
        ensureRelays(relayHintsRef.current);

        if (publicKey) {
          const memberStatus = await isMember(groupId, publicKey);
          // console.log(`TeamDetail: Membership check for ${publicKey} in group ${groupId}: ${memberStatus}`);
          setIsMemberState(memberStatus);
        }
        
        // Ensure loadGroupMembers is called *after* basic checks and NDK readiness check
        await loadGroupMembers(groupId, ndk, relayHintsRef.current);

      } catch (err) {
        console.error("❌ TeamDetail: Error during simplified executeLoad:", err);
        setError(err.message || "Failed to load group members/status.");
      } finally {
        setIsLoadingData(false);
      }
    };

    executeLoad();
  }, [groupId, naddrStringFromUrl, publicKey, ndkInitError, ndkReady, relayCount, loadGroupMembers, ndk]); // Added ndk back as loadGroupMembers depends on it
  
  if (ndkInitError) {
    return <div className="container error-message">Error initializing Nostr: {ndkInitError}</div>;
  }

  const groupName = displayName; 
  const groupPicture = displayPicture;
  
  console.log('TeamDetail render state (Simplified Metadata):', { 
    hasMetadata: true, // Assume true if name/pic are passed
    metadataContent: { name: groupName, picture: groupPicture }, // Representing passed data
    isLoadingData, // Now reflects member loading mostly
    ndkReady,
    relayCount,
    ndkInitError,
    error,
    activeTab,
    groupId
  });

  return (
    <div className="container team-detail-container run-club-theme">
      {error && !isLoadingData && <div className="error-message">Error: {error}</div>}
      
      <div className="team-header">
        {/* <img src={groupPicture} alt={groupName} className="team-avatar" onError={(e) => { e.target.src = '/default-avatar.png'; }} /> */}
        <h2>{groupName}</h2>
        {/* Removed groupAbout paragraph as it's not passed currently */}
        {/* <p>{groupAbout}</p> */} 
        {/* Keep loading indicator if member loading takes time? */}
        {/* {isLoadingData && <div className="info-message">Loading group members...</div>} */}
        {/* Loading message removed as per requirement */}
      </div>

      <div className="team-tabs">
        <button className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Group Chat</button>
        {/* Pinned tab removed */}
      </div>

      <div className="tab-content">
        {activeTab === 'chat' && (
          groupId ? 
            <ChatRoom groupId={groupId} naddrString={naddrStringFromUrl} publicKey={publicKey} relayHints={relayHintsRef.current} /> :
            <p className="info-message">Group identifier not available for chat.</p>
        )}
        {/* Pinned tab content removed */}
      </div>
    </div>
  );
};

export default TeamDetail; 