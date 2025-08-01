import { useState, useEffect, useCallback } from 'react';
import { useNostr } from './useNostr';
import EventNotificationService from '../services/EventNotificationService';

/**
 * Hook: useCaptainNotifications
 * 
 * Manages join request notifications for team captains.
 * Provides real-time updates when users request to join events.
 * Uses team member targeting for optimized queries when team context is available.
 * 
 * @param {string} captainPubkey - The captain's pubkey (should match current user)
 * @param {string} eventId - Optional: filter notifications for specific event
 * @param {string} teamUUID - Optional: team UUID for targeted member queries (optimization)
 * @returns {Object} Hook state and methods
 */
export const useCaptainNotifications = (captainPubkey, eventId = null, teamUUID = null) => {
  const { ndk, ndkReady, publicKey } = useNostr();
  
  // State
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Only show notifications if current user is the captain
  const isCurrentUserCaptain = publicKey === captainPubkey;

  // Unread count
  const unreadCount = notifications.length;

  /**
   * Fetch notifications from Nostr
   */
  const fetchNotifications = useCallback(async () => {
    if (!ndk || !ndkReady || !captainPubkey || !isCurrentUserCaptain) {
      setIsLoading(false);
      return;
    }

    try {
      console.log(`[useCaptainNotifications] Fetching notifications for captain ${captainPubkey}`);
      setError(null);
      
      const notifications = await EventNotificationService.fetchJoinRequestNotifications(
        ndk, 
        captainPubkey, 
        eventId,
        teamUUID // OPTIMIZATION: Pass team UUID for targeted queries
      );
      
      setNotifications(notifications);
      setLastUpdated(new Date());
      console.log(`[useCaptainNotifications] Loaded ${notifications.length} notifications`);
    } catch (err) {
      console.error('[useCaptainNotifications] Error fetching notifications:', err);
      setError(err.message || 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [ndk, ndkReady, captainPubkey, eventId, teamUUID, isCurrentUserCaptain]);

  /**
   * Approve a join request - add user to official participant list
   */
  const approveJoinRequest = useCallback(async (notification) => {
    if (!ndk || !notification) {
      throw new Error('Invalid parameters for approving join request');
    }

    try {
      console.log(`[useCaptainNotifications] Approving join request for ${notification.requesterPubkey}`);
      
      // First, get current official participant list
      const EventParticipationService = await import('../services/EventParticipationService');
      const currentParticipants = await EventParticipationService.fetchOfficialEventParticipants(
        ndk, 
        notification.eventId, 
        captainPubkey
      );

      // Add the new participant
      const currentPubkeys = currentParticipants.map(p => p.pubkey);
      if (!currentPubkeys.includes(notification.requesterPubkey)) {
        const updatedPubkeys = [...currentPubkeys, notification.requesterPubkey];
        
        // Publish updated participant list
        await EventParticipationService.publishOfficialParticipantList(
          ndk,
          notification.eventId,
          updatedPubkeys,
          notification.eventName
        );

        console.log(`[useCaptainNotifications] Successfully approved ${notification.requesterPubkey}`);
      }

      // Mark notification as processed
      await EventNotificationService.markNotificationProcessed(
        notification.id, 
        'approved'
      );

      // Remove from local notifications list
      setNotifications(prev => prev.filter(n => n.id !== notification.id));

      return true;
    } catch (error) {
      console.error('[useCaptainNotifications] Error approving join request:', error);
      throw error;
    }
  }, [ndk, captainPubkey]);

  /**
   * Deny a join request
   */
  const denyJoinRequest = useCallback(async (notification) => {
    try {
      console.log(`[useCaptainNotifications] Denying join request for ${notification.requesterPubkey}`);

      // Mark notification as processed
      await EventNotificationService.markNotificationProcessed(
        notification.id, 
        'denied'
      );

      // Remove from local notifications list
      setNotifications(prev => prev.filter(n => n.id !== notification.id));

      return true;
    } catch (error) {
      console.error('[useCaptainNotifications] Error denying join request:', error);
      throw error;
    }
  }, []);

  /**
   * Refresh notifications
   */
  const refresh = useCallback(() => {
    console.log('[useCaptainNotifications] Refreshing notifications...');
    setIsLoading(true);
    fetchNotifications();
  }, [fetchNotifications]);

  // Initial load
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Auto-refresh every 30 seconds if captain
  useEffect(() => {
    if (!isCurrentUserCaptain || !ndkReady) return;

    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchNotifications, isCurrentUserCaptain, ndkReady]);

  return {
    // Notification data
    notifications,
    unreadCount,
    isCurrentUserCaptain,
    
    // Loading states
    isLoading,
    error,
    lastUpdated,
    
    // Actions
    approveJoinRequest,
    denyJoinRequest,
    refresh,
    
    // Debug info
    debugInfo: {
      captainPubkey,
      eventId,
      publicKey,
      ndkReady,
      isCurrentUserCaptain
    }
  };
};