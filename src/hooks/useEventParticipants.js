import { useState, useEffect, useCallback, useMemo } from 'react';
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
          
          // Only update if we got more/different data
          if (hybridParticipants.length >= localParticipants.length) {
            setParticipants(hybridParticipants);
            setDataSource(hybridParticipants.some(p => p.source === 'official') ? 'hybrid' : 'local_enhanced');
            console.log(`[useEventParticipants] Enhanced with ${hybridParticipants.length} hybrid participants`);
          }
        } catch (nostrError) {
          console.warn('[useEventParticipants] Nostr enhancement failed, keeping local data:', nostrError);
          setError('Limited participant data - network issues');
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

  /**
   * Join event - immediately stored in localStorage for optimistic UI
   */
  const joinEvent = useCallback(async () => {
    if (!eventId || !publicKey) {
      throw new Error('EventId and user authentication required');
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

      // Update local state immediately
      const newParticipant = {
        pubkey: publicKey,
        joinedAt: Date.now(),
        status: 'active',
        source: 'localStorage'
      };

      setParticipants(prev => {
        // Avoid duplicates
        if (prev.some(p => p.pubkey === publicKey)) return prev;
        return [...prev, newParticipant];
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
      throw new Error('EventId and user authentication required');
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
      
      // Update local state immediately
      setParticipants(prev => prev.filter(p => p.pubkey !== publicKey || p.source === 'official'));
      
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
    if (ndkReady && !isLoading) {
      console.log('[useEventParticipants] NDK ready, enhancing participants with Nostr data');
      // Only refresh if we haven't already, to avoid repeated network calls
      if (dataSource === 'local') {
        fetchParticipants();
      }
    }
  }, [ndkReady]); // Removed fetchParticipants dependency to prevent loops

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