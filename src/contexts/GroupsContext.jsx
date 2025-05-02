import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import { NostrContext } from './NostrContext';
import NostrGroupsService from '../services/NostrGroupsService';
import { parseNaddr } from '../utils/nostrClient';

// Create context
export const GroupsContext = createContext();

// Custom hook for using Groups context
export const useGroups = () => {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
};

export const GroupsProvider = ({ children }) => {
  // Get Nostr context
  const contextValue = useContext(NostrContext);
  const { publicKey: nostrPublicKey } = contextValue || {};
  
  console.log("GroupsProvider: NostrContext value:", !!contextValue);
  console.log("GroupsProvider: nostrPublicKey:", nostrPublicKey);
  
  // State for user's groups
  const [myGroups, setMyGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  
  // State for membership operations
  const [membershipInProgress, setMembershipInProgress] = useState({});
  const [membershipStatus, setMembershipStatus] = useState({});
  
  // Group messaging state
  const [activeSubscriptions, setActiveSubscriptions] = useState({});

  // Add nostrInitialized state to ensure compatibility with components using TeamsContext
  const [nostrInitialized, setNostrInitialized] = useState(false);
  
  // Error state
  const [error, setError] = useState(null);

  // Initialize Nostr status when component mounts
  useEffect(() => {
    // Set Nostr as initialized since we're using GroupsContext
    // This maintains compatibility with components that check this value
    console.log("GroupsProvider: Setting nostrInitialized to true");
    setNostrInitialized(true);
  }, []);

  // Fetch user's groups when publicKey changes
  useEffect(() => {
    console.log("GroupsProvider: publicKey changed:", nostrPublicKey);
    
    const fetchGroups = async () => {
      if (!nostrPublicKey) {
        console.log("GroupsProvider: No publicKey, clearing groups");
        setMyGroups([]);
        return;
      }

      console.log("GroupsProvider: Fetching groups for publicKey:", nostrPublicKey);
      setLoadingGroups(true);
      setError(null);

      try {
        const userGroups = await NostrGroupsService.fetchUserGroups(nostrPublicKey);
        console.log("GroupsProvider: Fetched groups:", userGroups?.length || 0);
        setMyGroups(userGroups || []);
      } catch (err) {
        console.error('GroupsProvider: Error fetching user groups:', err);
        setError('Failed to fetch your groups. Please try again later.');
      } finally {
        setLoadingGroups(false);
      }
    };

    fetchGroups();
  }, [nostrPublicKey]);

  // Check membership status for a specific group
  const checkMembership = useCallback(async (naddr) => {
    if (!nostrPublicKey) return false;
    
    try {
      const isMember = await NostrGroupsService.isGroupMember(naddr);
      setMembershipStatus(prev => ({ ...prev, [naddr]: isMember }));
      return isMember;
    } catch (err) {
      console.error('Error checking membership:', err);
      return false;
    }
  }, [nostrPublicKey]);

  // Join a group
  const joinGroup = useCallback(async (naddr) => {
    if (!nostrPublicKey) {
      setError('You must be logged in to join a group');
      return false;
    }

    setMembershipInProgress(prev => ({ ...prev, [naddr]: 'joining' }));
    
    try {
      const result = await NostrGroupsService.joinGroup(naddr);
      
      if (result) {
        // Update membership status
        setMembershipStatus(prev => ({ ...prev, [naddr]: true }));
        
        // Refresh groups list
        const userGroups = await NostrGroupsService.fetchUserGroups(nostrPublicKey);
        setMyGroups(userGroups || []);
      }
      
      return result;
    } catch (err) {
      console.error('Error joining group:', err);
      setError(`Failed to join group: ${err.message}`);
      return false;
    } finally {
      setMembershipInProgress(prev => ({ ...prev, [naddr]: null }));
    }
  }, [nostrPublicKey]);

  // Leave a group
  const leaveGroup = useCallback(async (naddr) => {
    if (!nostrPublicKey) {
      setError('You must be logged in to leave a group');
      return false;
    }

    setMembershipInProgress(prev => ({ ...prev, [naddr]: 'leaving' }));
    
    try {
      const result = await NostrGroupsService.leaveGroup(naddr);
      
      if (result) {
        // Update membership status
        setMembershipStatus(prev => ({ ...prev, [naddr]: false }));
        
        // Refresh groups list
        const userGroups = await NostrGroupsService.fetchUserGroups(nostrPublicKey);
        setMyGroups(userGroups || []);
      }
      
      return result;
    } catch (err) {
      console.error('Error leaving group:', err);
      setError(`Failed to leave group: ${err.message}`);
      return false;
    } finally {
      setMembershipInProgress(prev => ({ ...prev, [naddr]: null }));
    }
  }, [nostrPublicKey]);

  // Fetch group metadata
  const getGroupMetadata = useCallback(async (naddr) => {
    try {
      return await NostrGroupsService.getGroupMetadata(naddr);
    } catch (err) {
      console.error('Error fetching group metadata:', err);
      setError(`Failed to fetch group information: ${err.message}`);
      return null;
    }
  }, []);

  // Send a message to a group
  const sendGroupMessage = useCallback(async (naddr, content) => {
    if (!nostrPublicKey) {
      setError('You must be logged in to send messages');
      return null;
    }

    try {
      const groupInfo = parseNaddr(naddr);
      if (!groupInfo) {
        throw new Error('Invalid group address');
      }
      
      return await NostrGroupsService.sendMessage(groupInfo, content);
    } catch (err) {
      console.error('Error sending message:', err);
      setError(`Failed to send message: ${err.message}`);
      return null;
    }
  }, [nostrPublicKey]);

  // Get pinned messages for a group using Nostr-native approach
  const getPinnedMessages = useCallback(async (naddr) => {
    if (!nostrPublicKey) {
      return [];
    }
    
    try {
      return await NostrGroupsService.getPinnedMessages(naddr, nostrPublicKey);
    } catch (err) {
      console.error('Error getting pinned messages:', err);
      return [];
    }
  }, [nostrPublicKey]);

  // Pin a message using Nostr-native approach
  const pinMessage = useCallback(async (message, naddr) => {
    if (!nostrPublicKey) {
      setError('You must be logged in to pin messages');
      return false;
    }
    
    try {
      return await NostrGroupsService.pinMessage(message, naddr, nostrPublicKey);
    } catch (err) {
      console.error('Error pinning message:', err);
      setError(`Failed to pin message: ${err.message}`);
      return false;
    }
  }, [nostrPublicKey]);

  // Unpin a message using Nostr-native approach
  const unpinMessage = useCallback(async (messageId, naddr) => {
    if (!nostrPublicKey) {
      setError('You must be logged in to unpin messages');
      return false;
    }
    
    try {
      return await NostrGroupsService.unpinMessage(messageId, naddr, nostrPublicKey);
    } catch (err) {
      console.error('Error unpinning message:', err);
      setError(`Failed to unpin message: ${err.message}`);
      return false;
    }
  }, [nostrPublicKey]);

  // Refreshes the user's groups list
  const refreshGroups = useCallback(async () => {
    if (!nostrPublicKey) {
      return;
    }
    
    setLoadingGroups(true);
    
    try {
      const userGroups = await NostrGroupsService.fetchUserGroups(nostrPublicKey);
      setMyGroups(userGroups || []);
    } catch (err) {
      console.error('Error refreshing groups:', err);
      setError('Failed to refresh your groups');
    } finally {
      setLoadingGroups(false);
    }
  }, [nostrPublicKey]);

  // Clear any error message
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Context value
  const value = {
    myGroups,
    loadingGroups,
    error,
    membershipInProgress,
    membershipStatus,
    nostrInitialized,
    joinGroup,
    leaveGroup,
    checkMembership,
    getGroupMetadata,
    sendGroupMessage,
    getPinnedMessages,
    pinMessage,
    unpinMessage,
    refreshGroups,
    clearError
  };

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  );
};

GroupsProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export default GroupsProvider; 