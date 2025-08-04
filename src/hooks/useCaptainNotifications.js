import { useState, useEffect, useCallback, useRef } from 'react';
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
  
  // Pokey real-time notification state
  const [pokeyEnabled, setPokeyEnabled] = useState(false);
  const [notificationSource, setNotificationSource] = useState('polling'); // 'polling' or 'pokey'
  const hybridSystemRef = useRef(null);

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
   * Handle incoming real-time notifications from Pokey
   */
  const handleRealtimeNotification = useCallback((notification) => {
    console.log('[useCaptainNotifications] Received real-time notification:', notification);
    
    setNotifications(prev => {
      // Check if we already have this notification (avoid duplicates)
      const exists = prev.find(n => n.id === notification.id);
      if (exists) {
        console.log('[useCaptainNotifications] Duplicate notification ignored:', notification.id);
        return prev;
      }
      
      // Add the new notification at the beginning (most recent first)
      const updated = [notification, ...prev];
      console.log(`[useCaptainNotifications] Added real-time notification, total: ${updated.length}`);
      return updated;
    });
    
    setLastUpdated(new Date());
    setNotificationSource(notification.source || 'pokey');
  }, []);

  /**
   * Setup hybrid notification system (Pokey + polling fallback)
   */
  const setupNotificationSystem = useCallback(async () => {
    if (!ndk || !ndkReady || !captainPubkey || !isCurrentUserCaptain) {
      return;
    }

    try {
      console.log('[useCaptainNotifications] Setting up hybrid notification system');
      
      // Clean up existing system
      if (hybridSystemRef.current && hybridSystemRef.current.cleanup) {
        hybridSystemRef.current.cleanup();
        hybridSystemRef.current = null;
      }
      
      // Setup hybrid system with Pokey + polling fallback
      const hybridSystem = await EventNotificationService.setupHybridNotificationSystem(
        ndk,
        captainPubkey,
        handleRealtimeNotification,
        {
          enablePokey: true,
          pollingInterval: 30000, // 30 seconds (reduced if Pokey is active)
          fallbackToPolling: true
        }
      );
      
      hybridSystemRef.current = hybridSystem;
      setPokeyEnabled(hybridSystem.pokeyEnabled);
      
      console.log(`[useCaptainNotifications] Hybrid system setup complete - Pokey: ${hybridSystem.pokeyEnabled}, Polling: ${hybridSystem.pollingActive}`);
      
    } catch (error) {
      console.error('[useCaptainNotifications] Error setting up notification system:', error);
      setError(error.message || 'Failed to setup notifications');
      setPokeyEnabled(false);
    }
  }, [ndk, ndkReady, captainPubkey, isCurrentUserCaptain, handleRealtimeNotification]);

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

  // Initial load and setup hybrid notification system
  useEffect(() => {
    if (!isCurrentUserCaptain || !ndkReady) {
      setIsLoading(false);
      return;
    }

    // First, do an initial fetch to get existing notifications
    fetchNotifications();
    
    // Then setup the hybrid system for real-time updates
    setupNotificationSystem();
    
    // Cleanup on unmount or dependency change
    return () => {
      if (hybridSystemRef.current && hybridSystemRef.current.cleanup) {
        console.log('[useCaptainNotifications] Cleaning up hybrid notification system');
        hybridSystemRef.current.cleanup();
        hybridSystemRef.current = null;
      }
    };
  }, [isCurrentUserCaptain, ndkReady, setupNotificationSystem, fetchNotifications]);

  return {
    // Notification data
    notifications,
    unreadCount,
    isCurrentUserCaptain,
    
    // Loading states
    isLoading,
    error,
    lastUpdated,
    
    // Real-time notification status
    pokeyEnabled,
    notificationSource,
    isRealTimeActive: pokeyEnabled,
    
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
      isCurrentUserCaptain,
      pokeyEnabled,
      notificationSource,
      hybridSystemActive: !!hybridSystemRef.current
    }
  };
};