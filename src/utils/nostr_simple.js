/**
 * nostr_simple.js
 * Simplified Nostr utilities using AuthService for Amber-only authentication
 * 
 * This file replaces the complex nostr.js with a simple, predictable API
 */

import { NDKEvent, NDKRelaySet } from '@nostr-dev-kit/ndk';
import AuthService from '../services/AuthService.js';
import { createAndPublishEvent as publishWithNostrTools } from './nostrClient.js';
import { encryptContentNip44 } from './nip44.js';
import { ndk, ndkReadyPromise } from '../lib/ndkSingleton.js';

// Storage for subscriptions
const activeSubscriptions = new Set();

// Default timeout (ms) for one-shot fetches where UI is waiting
const DEFAULT_FETCH_TIMEOUT = 8000; // 8 seconds

/**
 * Fetch events from Nostr
 * @param {Object} filter - Nostr filter
 * @param {Object} fetchOpts - Additional fetch options
 * @returns {Promise<Set<NDKEvent>>} Set of events
 */
export const fetchEvents = async (filter, fetchOpts = {}) => {
  // Split out timeout so we can still forward other NDK opts untouched
  const { timeout = DEFAULT_FETCH_TIMEOUT, ...ndkOpts } = fetchOpts;

  try {
    const ndkReady = await ndkReadyPromise;
    if (!ndkReady) {
      console.warn('[nostr_simple] NDK not ready – no relays connected. Aborting fetch.');
      return new Set();
    }

    console.log('[nostr_simple] Fetching events with filter:', filter);
    if (!filter.limit) {
      filter.limit = 30;
    }

    // Race the real fetch against a timeout so a single silent relay can't block
    const ndkFetchPromise = ndk.fetchEvents(filter, ndkOpts);
    const timeoutPromise = new Promise((resolve) => setTimeout(() => {
      console.warn(`[nostr_simple] fetchEvents timeout (${timeout} ms) for filter`, filter);
      resolve(new Set());
    }, timeout));

    const events = await Promise.race([ndkFetchPromise, timeoutPromise]);
    console.log(`[nostr_simple] Fetched ${events.size} events`);
    return events;
  } catch (error) {
    console.error('[nostr_simple] Error in fetchEvents:', error);
    return new Set();
  }
};

/**
 * Create and publish an event to the nostr network
 * Simplified version using AuthService for all authentication
 * @param {Object} eventTemplate - Event template 
 * @param {string|null} pubkeyOverride - Override for pubkey (optional)
 * @param {Object} opts - Additional options for the event
 * @returns {Promise<Object>} Published event
 */
export const createAndPublishEvent = async (eventTemplate, pubkeyOverride = null, opts = {}) => {
  try {
    // Get publishing strategy metadata to return to caller
    const publishResult = {
      success: false,
      method: null,
      signMethod: 'amber',
      error: null
    };

    // Get pubkey from AuthService or use override
    let pubkey = pubkeyOverride || AuthService.getPublicKey();
    
    if (!pubkey) {
      throw new Error('No public key available. Please log in first.');
    }
    
    // Handle encryption if requested
    let processedTemplate = { ...eventTemplate };
    if (opts.encrypt) {
      const recipientPubkey = opts.recipientPubkey || pubkey; // encrypt-to-self by default
      const { cipherText, nip44Tags } = await encryptContentNip44(
        String(processedTemplate.content),
        recipientPubkey
      );
      processedTemplate = {
        ...processedTemplate,
        content: cipherText,
        tags: [...(processedTemplate.tags || []), ...nip44Tags]
      };
    }
    
    // Create the event with user's pubkey
    const event = {
      ...processedTemplate,
      pubkey,
      created_at: Math.floor(Date.now() / 1000)
    };
    
    // Sign using AuthService
    let signedEvent;
    try {
      signedEvent = await AuthService.signEvent(event);
      
      // Validate that we got a properly signed event
      if (!signedEvent || !signedEvent.sig || !signedEvent.id) {
        throw new Error('Event signing failed - no valid signature received');
      }
    } catch (signingError) {
      console.error('[nostr_simple] AuthService signing failed:', signingError);
      throw new Error(`Signing failed: ${signingError.message}`);
    }

    // Try NDK publishing first
    try {
      console.log('[nostr_simple] Publishing with NDK...');
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      
      // If specific relays are requested, create a relay set
      if (opts.relays && opts.relays.length > 0) {
        const relaySet = NDKRelaySet.fromRelayUrls(opts.relays, ndk);
        await ndkEvent.publish(relaySet);
      } else {
        // Use default relays
        await ndkEvent.publish();
      }
      
      publishResult.success = true;
      publishResult.method = 'ndk';
      console.log('[nostr_simple] Successfully published with NDK');
      
    } catch (ndkError) {
      console.warn('[nostr_simple] NDK publishing failed, trying nostr-tools fallback:', ndkError);
      
      try {
        // Fall back to nostr-tools
        await publishWithNostrTools(signedEvent);
        publishResult.success = true;
        publishResult.method = 'nostr-tools';
        console.log('[nostr_simple] Successfully published with nostr-tools fallback');
      } catch (fallbackError) {
        console.error('[nostr_simple] Fallback to nostr-tools also failed:', fallbackError);
        publishResult.error = fallbackError.message;
        
        // Provide specific error messages based on the failure type
        if (fallbackError.message.includes('network') || fallbackError.message.includes('timeout')) {
          throw new Error('Publishing failed due to network issues. Please check your internet connection and try again.');
        } else if (fallbackError.message.includes('relay') || fallbackError.message.includes('connection')) {
          throw new Error('Could not connect to Nostr relays. Please try again in a moment.');
        } else {
          throw new Error(`Publishing failed: ${fallbackError.message}. Please try again.`);
        }
      }
    }
    
    return { ...signedEvent, ...publishResult };
  } catch (error) {
    console.error('[nostr_simple] Error in createAndPublishEvent:', error);
    
    // Enhance error message if it's not already user-friendly
    if (error.message && (
      error.message.includes('Signing failed') || 
      error.message.includes('timeout') || 
      error.message.includes('network') ||
      error.message.includes('relay') ||
      error.message.includes('Publishing failed')
    )) {
      // Already has a user-friendly message, pass it through
      throw error;
    } else {
      // Generic error, provide helpful guidance
      throw new Error('Failed to publish to Nostr. Please check your connection and try again.');
    }
  }
};

/**
 * Create a workout event (Kind 1301)
 * @param {Object} runData - Run data
 * @returns {Object} Event template
 */
export const createWorkoutEvent = (runData) => {
  const tags = [];
  
  // Required tags for workout events
  if (runData.distance) {
    tags.push(['distance', runData.distance.toString(), runData.unit || 'km']);
  }
  if (runData.duration) {
    tags.push(['duration', runData.duration]);
  }
  if (runData.calories) {
    tags.push(['calories', runData.calories.toString()]);
  }
  if (runData.elevationGain) {
    tags.push(['elevation_gain', runData.elevationGain.toString()]);
  }
  if (runData.activityType) {
    tags.push(['activity_type', runData.activityType]);
  }
  
  // Location tag if available
  if (runData.location) {
    tags.push(['location', runData.location]);
  }
  
  // Team tag if user is in a team
  if (runData.teamId) {
    tags.push(['team', runData.teamId]);
  }
  
  return {
    kind: 1301,
    content: runData.content || `Completed ${runData.activityType || 'run'}: ${runData.distance}${runData.unit || 'km'} in ${runData.duration}`,
    tags
  };
};

/**
 * Subscribe to events with a callback
 * @param {Object} filter - Nostr filter
 * @param {Function} callback - Callback for new events
 * @param {Object} opts - Subscription options
 * @returns {Function} Unsubscribe function
 */
export const subscribeToEvents = (filter, callback, opts = {}) => {
  try {
    console.log('[nostr_simple] Subscribing to events with filter:', filter);
    
    const subscription = ndk.subscribe(filter, opts);
    activeSubscriptions.add(subscription);
    
    subscription.on('event', callback);
    subscription.on('close', () => {
      activeSubscriptions.delete(subscription);
    });
    
    // Return unsubscribe function
    return () => {
      subscription.stop();
      activeSubscriptions.delete(subscription);
    };
  } catch (error) {
    console.error('[nostr_simple] Error in subscribeToEvents:', error);
    return () => {}; // Return no-op function
  }
};

/**
 * Clean up all active subscriptions
 */
export const cleanup = () => {
  console.log(`[nostr_simple] Cleaning up ${activeSubscriptions.size} active subscriptions`);
  activeSubscriptions.forEach(sub => {
    try {
      sub.stop();
    } catch (error) {
      console.warn('[nostr_simple] Error stopping subscription:', error);
    }
  });
  activeSubscriptions.clear();
};

// Export the simplified API
export default {
  fetchEvents,
  createAndPublishEvent,
  createWorkoutEvent,
  subscribeToEvents,
  cleanup
};