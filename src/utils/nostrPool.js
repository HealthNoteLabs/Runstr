import { SimplePool } from 'nostr-tools';
import { RELAYS } from '../config/relays';

/**
 * Singleton SimplePool instance for the application
 * This ensures we only create one pool throughout the application lifecycle
 */
let poolInstance = null;

/**
 * Get the SimplePool instance (creates it if it doesn't exist)
 * @returns {SimplePool} The SimplePool instance
 */
export const getPool = () => {
  if (!poolInstance) {
    console.log('Creating new SimplePool instance');
    poolInstance = new SimplePool();
  }
  return poolInstance;
};

/**
 * Close all relay connections and reset the pool
 * @param {string[]} relays - Optional array of relay URLs to close (defaults to all)
 */
export const closePool = (relays = RELAYS) => {
  if (poolInstance) {
    console.log('Closing SimplePool connections');
    poolInstance.close(relays);
    poolInstance = null;
  }
};

/**
 * Get the count of currently connected relays
 * @returns {number} Number of connected relays
 */
export const getConnectedRelayCount = () => {
  if (!poolInstance) return 0;
  return poolInstance.getConnectedRelayCount();
};

/**
 * Subscribe to events with the pool
 * @param {Object} filter - Nostr filter
 * @param {string[]} relays - Array of relay URLs
 * @param {Function} onEvent - Callback for each event
 * @param {Function} onEose - Callback for end of stored events
 * @returns {Object} Subscription object
 */
export const subscribeWithPool = (filter, relays = RELAYS, onEvent, onEose) => {
  const pool = getPool();
  const sub = pool.sub(relays, [filter]);
  
  if (onEvent) sub.on('event', onEvent);
  if (onEose) sub.on('eose', onEose);
  
  return {
    subscription: sub,
    unsubscribe: () => {
      try {
        sub.unsub();
        return true;
      } catch (error) {
        console.error('Error unsubscribing:', error);
        return false;
      }
    }
  };
};

/**
 * Track all active subscriptions
 */
const activeSubscriptions = new Set();

/**
 * Subscribe with tracking (to ensure proper cleanup)
 * @param {Object} filter - Nostr filter
 * @param {string[]} relays - Array of relay URLs
 * @param {Function} onEvent - Callback for each event
 * @param {Function} onEose - Callback for end of stored events
 * @returns {Object} Subscription with tracking
 */
export const subscribeWithTracking = (filter, relays = RELAYS, onEvent, onEose) => {
  const { subscription, unsubscribe } = subscribeWithPool(filter, relays, onEvent, onEose);
  
  // Track this subscription
  activeSubscriptions.add(subscription);
  
  // Return enhanced unsubscribe that also removes from tracking
  return {
    subscription,
    unsubscribe: () => {
      const result = unsubscribe();
      activeSubscriptions.delete(subscription);
      return result;
    }
  };
};

/**
 * Clean up all tracked subscriptions
 */
export const cleanupAllSubscriptions = () => {
  console.log(`Cleaning up ${activeSubscriptions.size} active subscriptions`);
  
  activeSubscriptions.forEach(sub => {
    try {
      sub.unsub();
    } catch (error) {
      console.error('Error cleaning up subscription:', error);
    }
  });
  
  activeSubscriptions.clear();
}; 