import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { getPool, closePool, getConnectedRelayCount, cleanupAllSubscriptions } from '../utils/nostrPool';
import { RELAYS } from '../config/relays';
import { getNetworkStatus, onNetworkStatusChange } from '../utils/platform';
import { useMobileStorage } from './MobileStorageContext';

// Create context
export const NostrContext = createContext(null);

/**
 * Provider component for Nostr functionality
 */
export const NostrProvider = ({ children }) => {
  const [pubkey, setPubkey] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    connecting: false,
    connectedRelays: 0,
    totalRelays: RELAYS.length
  });
  const [authMethod, setAuthMethod] = useState(null);
  const [networkState, setNetworkState] = useState({ connected: true, connectionType: 'unknown' });
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const storage = useMobileStorage();
  
  /**
   * Clean up the queue by removing successfully published events
   */
  const cleanupQueue = useCallback(async () => {
    try {
      // Remove all published items older than 1 hour
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const filteredQueue = offlineQueue.filter(item => 
        item.status !== 'published' || 
        (item.publishedAt && item.publishedAt > oneHourAgo)
      );
      
      // Only update if something changed
      if (filteredQueue.length !== offlineQueue.length) {
        setOfflineQueue(filteredQueue);
        await storage.setJSON('nostr_offline_queue', filteredQueue);
        console.log(`Cleaned up queue. Removed ${offlineQueue.length - filteredQueue.length} published events`);
      }
    } catch (error) {
      console.error('Error cleaning up queue:', error);
    }
  }, [offlineQueue, storage]);

  /**
   * Synchronize offline queue when back online
   */
  const syncOfflineQueue = useCallback(async () => {
    // If already syncing or no items to sync, skip
    if (isSyncing || offlineQueue.length === 0 || !networkState.connected || !connected) {
      return;
    }
    
    try {
      setIsSyncing(true);
      console.log(`Starting sync of ${offlineQueue.length} queued events`);
      
      const pool = getPool();
      const updatedQueue = [...offlineQueue];
      let syncCount = 0;
      
      // Process each queued event
      for (let i = 0; i < updatedQueue.length; i++) {
        const item = updatedQueue[i];
        
        // Skip already processed items
        if (item.status !== 'pending') {
          continue;
        }
        
        try {
          // Attempt to publish the event
          const pubResult = await pool.publish(RELAYS, item.event);
          
          // Mark as published
          item.status = 'published';
          item.publishedAt = Date.now();
          item.publishResult = pubResult;
          syncCount++;
          
          // Update state every few items for better UX
          if (i % 3 === 0) {
            setOfflineQueue([...updatedQueue]);
            await storage.setJSON('nostr_offline_queue', updatedQueue);
          }
        } catch (error) {
          console.error(`Failed to publish queued event ${item.id}:`, error);
          
          // Mark as failed but keep in queue for retry
          item.status = 'failed';
          item.error = error.message;
          
          // Update state
          setOfflineQueue([...updatedQueue]);
          await storage.setJSON('nostr_offline_queue', updatedQueue);
        }
      }
      
      // Final update to state and storage
      setOfflineQueue(updatedQueue);
      await storage.setJSON('nostr_offline_queue', updatedQueue);
      
      console.log(`Sync completed. Published ${syncCount} events.`);
      
      // Clean up successful items after delay
      setTimeout(() => cleanupQueue(), 5000);
    } catch (error) {
      console.error('Error synchronizing offline queue:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [cleanupQueue, connected, isSyncing, networkState.connected, offlineQueue, storage]);
  
  // Monitor network status
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const status = await getNetworkStatus();
        setNetworkState(status);
      } catch (error) {
        console.error('Error checking network status:', error);
      }
    };
    
    // Initial check
    checkNetworkStatus();
    
    // Set up listener for network changes
    let cleanup;
    (async () => {
      cleanup = await onNetworkStatusChange((status) => {
        setNetworkState(status);
        if (!status.connected) {
          console.log('Network disconnected, pausing relay connections');
          // Optionally handle relay disconnections when network goes offline
        } else if (status.connected) {
          console.log('Network reconnected, resuming relay connections');
          // Trigger sync of offline queue when network comes back online
          syncOfflineQueue();
        }
      });
    })();
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [syncOfflineQueue]);

  // Check connection status periodically
  useEffect(() => {
    const checkConnection = () => {
      const connectedCount = getConnectedRelayCount();
      setConnectionStatus({
        connecting: false,
        connectedRelays: connectedCount,
        totalRelays: RELAYS.length
      });
      setConnected(connectedCount > 0);
    };
    
    // Initial check
    checkConnection();
    
    // Set up interval to check connection status
    const intervalId = setInterval(checkConnection, 10000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);
  
  // Load saved data when storage is ready
  useEffect(() => {
    const loadData = async () => {
      try {
        if (storage && storage.isReady) {
          // Check for existing login 
          const savedPubkey = await storage.getString('nostr_pubkey');
          const savedAuthMethod = await storage.getString('nostr_auth_method');
          
          if (savedPubkey) {
            setPubkey(savedPubkey);
          }
          
          if (savedAuthMethod) {
            setAuthMethod(savedAuthMethod);
          }
          
          // Load offline queue
          const savedQueue = await storage.getJSON('nostr_offline_queue');
          if (savedQueue && Array.isArray(savedQueue)) {
            setOfflineQueue(savedQueue);
          }
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    };
    
    loadData();
  }, [storage, storage.isReady]);
  
  // Initialize Nostr and check auth
  useEffect(() => {
    const initialize = async () => {
      if (!storage || !storage.isReady) {
        return;
      }
      
      try {
        // Initialize the relay pool
        getPool();
        
        // Set up connection status monitoring
        const interval = setInterval(() => {
          const connectedCount = getConnectedRelayCount();
          setConnectionStatus({
            connecting: connectedCount === 0 && !connected,
            connectedRelays: connectedCount,
            totalRelays: RELAYS.length
          });
          
          // Update connected state based on if we have any relays
          setConnected(connectedCount > 0);
        }, 1000);
        
        return () => {
          clearInterval(interval);
          closePool();
          cleanupAllSubscriptions();
        };
      } catch (error) {
        console.error('Error initializing Nostr:', error);
      }
    };
    
    initialize();
  }, [storage, storage.isReady, connected]);
  
  /**
   * Add an event to the offline queue
   * @param {Object} event - Nostr event to queue
   * @returns {string} ID of queued event
   */
  const queueEvent = async (event) => {
    try {
      // Generate a unique ID for this queued item
      const queueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Create queue item
      const queueItem = {
        id: queueId,
        event,
        timestamp: Date.now(),
        status: 'pending'
      };
      
      // Update state and storage
      const updatedQueue = [...offlineQueue, queueItem];
      setOfflineQueue(updatedQueue);
      await storage.setJSON('nostr_offline_queue', updatedQueue);
      
      console.log(`Event queued for offline publishing with ID: ${queueId}`);
      return queueId;
    } catch (error) {
      console.error('Error queueing event:', error);
      throw error;
    }
  };
  
  /**
   * Create and publish event, or queue if offline
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Result object with status and eventId
   */
  const createAndPublishEvent = async (eventData) => {
    try {
      // Check if we're online
      if (networkState.connected && connected) {
        // We're online, publish directly
        const pool = getPool();
        const event = await prepareEvent(eventData);
        const pubResult = await pool.publish(RELAYS, event);
        
        return {
          status: 'published',
          eventId: event.id,
          result: pubResult
        };
      } else {
        // We're offline, queue for later
        const event = await prepareEvent(eventData);
        const queueId = await queueEvent(event);
        
        return {
          status: 'queued',
          eventId: event.id,
          queueId
        };
      }
    } catch (error) {
      console.error('Error creating/publishing event:', error);
      
      // If publishing failed, queue the event
      try {
        const event = await prepareEvent(eventData);
        const queueId = await queueEvent(event);
        
        return {
          status: 'queued',
          eventId: event.id,
          queueId,
          error: error.message
        };
      } catch (queueError) {
        console.error('Failed to queue event after publishing error:', queueError);
        throw error; // Throw original error if queueing also fails
      }
    }
  };
  
  /**
   * Prepare an event for publishing
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Prepared event
   */
  const prepareEvent = async (eventData) => {
    if (!pubkey) {
      throw new Error('User not authenticated');
    }
    
    // Get current time
    const created_at = Math.floor(Date.now() / 1000);
    
    // Prepare event
    const event = {
      kind: eventData.kind || 1,
      created_at,
      tags: eventData.tags || [],
      content: eventData.content || '',
      pubkey
    };
    
    // Sign the event
    if (authMethod === 'android' && window.Android && window.Android.signNostrEvent) {
      // Use Android signing
      const signedEvent = await window.Android.signNostrEvent(JSON.stringify(event));
      return JSON.parse(signedEvent);
    } else if (authMethod === 'extension' && window.nostr) {
      // Use NIP-07 extension signing
      return await window.nostr.signEvent(event);
    } else {
      throw new Error('No signing method available');
    }
  };
  
  /**
   * Sign out the current user
   */
  const signOut = async () => {
    setPubkey(null);
    setAuthMethod(null);
    
    // Clear stored credentials
    try {
      await storage.removeItem('nostr_pubkey');
      await storage.removeItem('nostr_auth_method');
    } catch (error) {
      console.error('Error clearing stored credentials:', error);
    }
    
    // Clean up resources
    cleanupAllSubscriptions();
    closePool();
    
    // Reinitialize pool
    getPool();
  };
  
  /**
   * Request authentication
   */
  const requestAuth = async () => {
    try {
      setConnectionStatus(prev => ({ ...prev, connecting: true }));
      
      // Try Android interface first
      if (window.Android && window.Android.requestNostrAuth) {
        const result = await window.Android.requestNostrAuth();
        if (result && result.pubkey) {
          setPubkey(result.pubkey);
          setAuthMethod('android');
          await storage.setItem('nostr_pubkey', result.pubkey);
          await storage.setItem('nostr_auth_method', 'android');
          return true;
        }
      }
      
      // Try extension
      if (window.nostr) {
        const pk = await window.nostr.getPublicKey();
        if (pk) {
          setPubkey(pk);
          setAuthMethod('extension');
          await storage.setItem('nostr_pubkey', pk);
          await storage.setItem('nostr_auth_method', 'extension');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting authentication:', error);
      return false;
    } finally {
      setConnectionStatus(prev => ({ ...prev, connecting: false }));
    }
  };
  
  // Context value
  const value = {
    pubkey,
    connected,
    connectionStatus,
    authMethod,
    networkState,
    offlineQueue,
    isSyncing,
    requestAuth,
    signOut,
    relays: RELAYS,
    pool: getPool(),
    createAndPublishEvent,
    queueEvent,
    syncOfflineQueue,
    cleanupQueue
  };
  
  return (
    <NostrContext.Provider value={value}>
      {children}
    </NostrContext.Provider>
  );
};

NostrProvider.propTypes = {
  children: PropTypes.node.isRequired
};

/**
 * Hook to use the Nostr context
 */
export const useNostr = () => {
  const context = useContext(NostrContext);
  if (!context) {
    throw new Error('useNostr must be used within a NostrProvider');
  }
  return context;
};
