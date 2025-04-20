import { useState, useEffect } from 'react';
import { SimplePool } from 'nostr-tools';
import groupMembershipManager from '../services/GroupMembershipManager';
import { addUserToGroup, removeUserFromGroup } from '../utils/nostr/groups/membership';
import { getUserPublicKey } from '../utils/nostrClient';

// Pool for subscriptions
const pool = new SimplePool();

/**
 * Hook to check if a user is a member of a group and manage membership
 * @param {Object} group - The group object with naddr or group details
 * @param {string} [pubkey] - Optional user pubkey (defaults to current user)
 * @returns {Object} Membership status and operations
 */
export function useGroupMembership(group, pubkeyParam) {
  const [pubkey, setPubkey] = useState(pubkeyParam);
  const [isMember, setIsMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch current user's pubkey if not provided
  useEffect(() => {
    if (!pubkeyParam) {
      getUserPublicKey().then(pk => {
        if (pk) setPubkey(pk);
      }).catch(err => {
        console.error('Failed to get user pubkey', err);
        setError('Authentication required');
      });
    }
  }, [pubkeyParam]);

  // Check membership status whenever group or pubkey changes
  useEffect(() => {
    let isMounted = true;
    
    const checkMembership = async () => {
      if (!group || !pubkey) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Use group.naddr if available, otherwise construct from other properties
        const naddrToUse = group.naddr || group.id || null;
        if (!naddrToUse) {
          throw new Error('No valid group identifier found');
        }
        
        const membershipStatus = await groupMembershipManager.hasJoinedGroup(naddrToUse, pubkey);
        if (isMounted) {
          setIsMember(membershipStatus);
        }
      } catch (err) {
        console.error('Failed to check membership:', err);
        if (isMounted) {
          setError(err.message || 'Failed to check membership');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkMembership();
    
    // Set up subscription for membership events
    const setupSubscription = async () => {
      if (!group || !pubkey) return null;
      
      try {
        // Convert group to proper format for subscription
        const groupInfo = group.naddr 
          ? await groupMembershipManager.parseNaddr(group.naddr)
          : { identifier: group.id };
        
        if (!groupInfo || !groupInfo.identifier) return null;
        
        // Subscribe to membership-related events
        const sub = pool.subSync(groupMembershipManager.getGroupRelays(groupInfo), [
          {
            kinds: [42, 43], // Member additions and removals
            '#d': [groupInfo.identifier]
          }
        ]);
        
        sub.on('event', async (event) => {
          // Check if event is relevant to current user
          const isRelevantEvent = event.tags.some(tag => 
            tag[0] === 'p' && tag[1] === pubkey
          );
          
          if (isRelevantEvent) {
            // Clear cache for this specific group+user combo
            const groupId = group.naddr || group.id;
            groupMembershipManager.clearCache(groupId, pubkey);
            
            // Recheck membership
            try {
              const newStatus = await groupMembershipManager.hasJoinedGroup(
                group.naddr || group.id, 
                pubkey,
                true // force refresh
              );
              if (isMounted) {
                setIsMember(newStatus);
              }
            } catch (err) {
              console.error('Error updating membership status', err);
            }
          }
        });
        
        return sub;
      } catch (err) {
        console.error('Error setting up subscription', err);
        return null;
      }
    };
    
    const subPromise = setupSubscription();
    
    // Cleanup function
    return () => {
      isMounted = false;
      subPromise.then(sub => {
        if (sub) sub.unsub();
      });
    };
  }, [group, pubkey]);

  // Function to add user to group
  const addUser = async (userToAdd = pubkey) => {
    if (!group || !userToAdd) {
      throw new Error('Group or user not specified');
    }
    
    try {
      setError(null);
      const naddrToUse = group.naddr || group.id;
      const result = await addUserToGroup(naddrToUse, userToAdd);
      
      // Update local state if adding current user
      if (userToAdd === pubkey) {
        setIsMember(true);
        
        // Clear cache for this group
        groupMembershipManager.clearCache(naddrToUse, userToAdd);
      }
      
      return result;
    } catch (err) {
      setError(err.message || 'Failed to add user to group');
      throw err;
    }
  };

  // Function to remove user from group
  const removeUser = async (userToRemove = pubkey) => {
    if (!group || !userToRemove) {
      throw new Error('Group or user not specified');
    }
    
    try {
      setError(null);
      const naddrToUse = group.naddr || group.id;
      const result = await removeUserFromGroup(naddrToUse, userToRemove);
      
      // Update local state if removing current user
      if (userToRemove === pubkey) {
        setIsMember(false);
        
        // Clear cache for this group
        groupMembershipManager.clearCache(naddrToUse, userToRemove);
      }
      
      return result;
    } catch (err) {
      setError(err.message || 'Failed to remove user from group');
      throw err;
    }
  };

  // Function to refresh membership status manually
  const refresh = async () => {
    if (!group || !pubkey) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const naddrToUse = group.naddr || group.id;
      const status = await groupMembershipManager.hasJoinedGroup(
        naddrToUse, 
        pubkey,
        true // Force refresh from network
      );
      setIsMember(status);
    } catch (err) {
      console.error('Failed to refresh membership:', err);
      setError(err.message || 'Failed to refresh membership');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isMember,
    isLoading,
    error,
    addUser,
    removeUser,
    refresh
  };
}

export default useGroupMembership; 