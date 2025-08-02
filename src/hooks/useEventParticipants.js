import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNostr } from './useNostr';
import EventParticipationService from '../services/EventParticipationService';
import EventNotificationService from '../services/EventNotificationService';

/**
 * Hook: useEventParticipants
 * 
 * Manages event participation following the successful league pattern.
 * Combines localStorage (immediate joins) with official Nostr lists (captain-managed).
 * 
 * Features:
 * - Immediate local joins with localStorage
 * - Official captain-managed participant lists via Nostr
 * - Hybrid participant data with deduplication
 * - Real-time participation status
 * - Optimistic UI updates
 * 
 * @param {string} eventId - The event ID
 * @param {string} captainPubkey - Captain's pubkey who manages official list
 * @param {string} eventName - Event name for display
 * @param {string} teamAIdentifier - Team identifier for context
 * @returns {Object} Hook state and methods
 */
export const useEventParticipants = (eventId, captainPubkey, eventName, teamAIdentifier) => {
  const { ndk, ndkReady, publicKey } = useNostr();
  
  // State
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Memoized participation status for current user
  const isUserParticipating = useMemo(() => {
    if (!publicKey || !eventId) return false;
    return participants.some(p => p.pubkey === publicKey);
  }, [participants, publicKey, eventId]);

  // Memoized local participation status (for immediate UI feedback)
  const isUserParticipatingLocally = useMemo(() => {
    if (!publicKey || !eventId) return false;
    return EventParticipationService.isUserParticipatingLocally(eventId, publicKey);
  }, [eventId, publicKey, participants.length]); // Re-check when participants change

  // Participant count
  const participantCount = useMemo(() => participants.length, [participants]);

  // Data source tracking
  const [dataSource, setDataSource] = useState('loading');
  
  // Ref to prevent infinite loops in useEffect
  const fetchParticipantsRef = useRef(null);

  /**
   * Fetch participants using league-pattern cache-first approach
   */
  const fetchParticipants = useCallback(async () => {
    if (!eventId) {
      console.warn('[useEventParticipants] No eventId provided');
      setIsLoading(false);
      return;
    }

    try {
      console.log(`[useEventParticipants] Fetching participants for event ${eventId}`);
      setError(null);
      
      // LEAGUE PATTERN: Always start with local data immediately (cache-first)
      const localParticipants = EventParticipationService.getLocalEventParticipants(eventId);
      setParticipants(localParticipants);
      setDataSource('local');
      console.log(`[useEventParticipants] Showing ${localParticipants.length} local participants immediately`);
      
      // LEAGUE PATTERN: Progressive enhancement with Nostr data (non-blocking)
      if (ndkReady && ndk && captainPubkey) {
        try {
          const hybridParticipants = await EventParticipationService.fetchHybridEventParticipants(
            ndk, 
            eventId, 
            captainPubkey
          );
          
          // Always update with hybrid data if it contains official participants
          // This ensures captain removals are respected even if count is lower
          const hasOfficialData = hybridParticipants.some(p => p.source === 'official');
          
          if (hasOfficialData || hybridParticipants.length >= localParticipants.length) {
            setParticipants(hybridParticipants);
            setDataSource(hasOfficialData ? 'hybrid' : 'local_enhanced');
            console.log(`[useEventParticipants] Enhanced with ${hybridParticipants.length} hybrid participants (official: ${hasOfficialData})`);
          } else {
            // Only use local data if no official data and fewer participants
            console.log(`[useEventParticipants] Keeping ${localParticipants.length} local participants (no official data, fewer hybrid)`);
          }
        } catch (nostrError) {
          console.warn('[useEventParticipants] Nostr enhancement failed, keeping local data:', nostrError);
          setError('Some participant data may be outdated due to connection issues');
          // Keep the local data we already set
        }
      } else {
        console.log('[useEventParticipants] NDK not ready, showing local data only');
      }
      
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[useEventParticipants] Error in fetchParticipants:', err);
      setError(err.message || 'Failed to load participants');
      
      // LEAGUE PATTERN: Final fallback ensures we always show something
      try {
        const fallbackParticipants = EventParticipationService.getLocalEventParticipants(eventId);
        setParticipants(fallbackParticipants);
        setDataSource('fallback');
      } catch (fallbackError) {
        console.error('[useEventParticipants] Complete fallback failed:', fallbackError);
        setParticipants([]); // Show empty state rather than crash
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventId, captainPubkey, ndk, ndkReady]);
  
  // Update ref when fetchParticipants changes
  fetchParticipantsRef.current = fetchParticipants;

  /**
   * Join event - immediately stored in localStorage for optimistic UI
   */
  const joinEvent = useCallback(async () => {
    if (!eventId || !publicKey) {
      throw new Error('Please sign in to join events');
    }

    if (isJoining || isUserParticipatingLocally) {
      console.log('[useEventParticipants] Already joining or already participating');
      return false;
    }

    setIsJoining(true);
    try {
      console.log(`[useEventParticipants] Joining event ${eventId}`);

      // Immediate local join for optimistic UI
      EventParticipationService.joinEventLocally(
        eventId, 
        teamAIdentifier, 
        eventName, 
        publicKey
      );

      // Update local state immediately (optimistic update) with synchronization
      const newParticipant = {
        pubkey: publicKey,
        joinedAt: Date.now(),
        status: 'active',
        source: 'localStorage'
      };

      setParticipants(prev => {
        // Avoid duplicates and preserve official participants
        const existingParticipant = prev.find(p => p.pubkey === publicKey);
        if (existingParticipant) {
          console.log('[useEventParticipants] User already in participants list, updating source if needed');
          // Update existing participant to show it's now local + official if needed
          return prev.map(p => 
            p.pubkey === publicKey 
              ? { ...p, source: p.source === 'official' ? 'hybrid' : 'localStorage', joinedAt: Date.now() }
              : p
          );
        }
        
        // Add user while preserving existing participants with stable ordering
        const updated = [...prev, newParticipant].sort((a, b) => {
          // Official participants first, then by join time
          if (a.source === 'official' && b.source !== 'official') return -1;
          if (b.source === 'official' && a.source !== 'official') return 1;
          return (b.joinedAt || 0) - (a.joinedAt || 0);
        });
        console.log(`[useEventParticipants] Optimistically added user to participants (${updated.length} total)`);
        return updated;
      });

      // Send notification to captain (if NDK is ready)
      try {
        if (ndk && ndkReady && captainPubkey && captainPubkey !== publicKey) {
          console.log(`[useEventParticipants] Sending join request notification to captain`);
          await EventNotificationService.sendJoinRequestNotification(ndk, {
            eventId,
            eventName,
            teamAIdentifier,
            captainPubkey,
            requesterPubkey: publicKey,
            requesterName: null // Could be enhanced to get user's display name
          });
          console.log(`[useEventParticipants] Join request notification sent`);
        }
      } catch (notificationError) {
        // Don't fail the join if notification fails
        console.warn('[useEventParticipants] Failed to send join notification:', notificationError);
      }

      console.log(`[useEventParticipants] Successfully joined event ${eventId}`);
      return true;
    } catch (err) {
      console.error('[useEventParticipants] Error joining event:', err);
      setError(err.message || 'Failed to join event');
      throw err;
    } finally {
      setIsJoining(false);
    }
  }, [eventId, publicKey, teamAIdentifier, eventName, isJoining, isUserParticipatingLocally, ndk, ndkReady, captainPubkey]);

  /**
   * Leave event - remove from localStorage
   */
  const leaveEvent = useCallback(async () => {
    if (!eventId || !publicKey) {
      throw new Error('Please sign in to leave events');
    }

    if (isLeaving || !isUserParticipatingLocally) {
      console.log('[useEventParticipants] Already leaving or not participating');
      return false;
    }

    setIsLeaving(true);
    try {
      console.log(`[useEventParticipants] Leaving event ${eventId}`);
      
      // Remove from localStorage
      EventParticipationService.leaveEventLocally(eventId, publicKey);
      
      // Update local state immediately - handle different source types properly
      setParticipants(prev => {
        const updated = prev.map(p => {
          if (p.pubkey === publicKey) {
            // If user was hybrid (official + local), keep official part only
            if (p.source === 'hybrid') {
              return { ...p, source: 'official' };
            }
            // If user was local only, remove completely
            if (p.source === 'localStorage') {
              return null;
            }
            // If user was official only, keep as is (captain managed)
            return p;
          }
          return p;
        }).filter(Boolean); // Remove null entries
        
        console.log(`[useEventParticipants] Updated user participation status (${updated.length} remaining)`);
        return updated;
      });
      
      console.log(`[useEventParticipants] Successfully left event ${eventId}`);
      return true;
    } catch (err) {
      console.error('[useEventParticipants] Error leaving event:', err);
      setError(err.message || 'Failed to leave event');
      throw err;
    } finally {
      setIsLeaving(false);
    }
  }, [eventId, publicKey, isLeaving, isUserParticipatingLocally]);

  /**
   * Refresh participants data
   */
  const refresh = useCallback(() => {
    console.log('[useEventParticipants] Refreshing participants...');
    setIsLoading(true);
    fetchParticipants();
  }, [fetchParticipants]);

  // Initial load and setup
  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  // LEAGUE PATTERN: Less aggressive auto-refresh, don't depend on NDK state
  useEffect(() => {
    if (ndkReady && !isLoading && dataSource === 'local') {
      console.log('[useEventParticipants] NDK ready, enhancing participants with Nostr data');
      // Only refresh if we haven't already loaded official data
      const timeoutId = setTimeout(() => {
        if (fetchParticipantsRef.current) {
          fetchParticipantsRef.current();
        }
      }, 100); // Small delay to prevent race conditions
      
      return () => clearTimeout(timeoutId);
    }
  }, [ndkReady, isLoading, dataSource]); // Safe dependencies that won't cause loops

  return {
    // Participant data
    participants,
    participantCount,
    isUserParticipating,
    isUserParticipatingLocally, // For immediate UI feedback
    
    // Loading states
    isLoading,
    isJoining,
    isLeaving,
    error,
    lastUpdated,
    dataSource,
    
    // Actions
    joinEvent,
    leaveEvent,
    refresh,
    
    // Debug info
    debugInfo: {
      eventId,
      captainPubkey,
      ndkReady,
      hasPublicKey: !!publicKey,
      participantSources: participants.reduce((acc, p) => {
        acc[p.source] = (acc[p.source] || 0) + 1;
        return acc;
      }, {})
    }
  };
};