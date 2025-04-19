import { finalizeEvent, verifyEvent } from 'nostr-tools';
import { pool, relays } from './connection.js';
import { getUserPublicKey, getSigningKey } from './auth.js';

/**
 * Create and publish an event to the nostr network
 * @param {Object} eventTemplate Template for the event or a pre-signed event
 * @param {Uint8Array} privateKey Private key to sign with (optional)
 * @returns {Promise<Object>} The published event
 */
export const createAndPublishEvent = async (eventTemplate, privateKey) => {
  try {
    let signedEvent;
    
    // Check if we're being passed a pre-signed event (when used as a fallback)
    if (eventTemplate.sig && eventTemplate.pubkey && eventTemplate.created_at) {
      // This is already a signed event, no need to sign it again
      signedEvent = eventTemplate;
      
      // Verify the signature to be safe
      const valid = verifyEvent(signedEvent);
      if (!valid) {
        throw new Error('Pre-signed event signature verification failed');
      }
    } else {
      // We need to sign the event ourselves
      
      // Get signing key if not provided
      const sk = privateKey || await getSigningKey();
      if (!sk) {
        throw new Error('No signing key available');
      }
      
      // Get user's public key
      const pk = await getUserPublicKey();
      if (!pk) {
        throw new Error('No public key available');
      }
      
      // Create the event
      const event = {
        ...eventTemplate,
        pubkey: pk,
        created_at: Math.floor(Date.now() / 1000),
        tags: eventTemplate.tags || []
      };
      
      // Sign the event
      signedEvent = finalizeEvent(event, sk);
      
      // Verify the signature
      const valid = verifyEvent(signedEvent);
      if (!valid) {
        throw new Error('Event signature verification failed');
      }
    }
    
    // Publish the event to all relays
    pool.publish(relays, signedEvent);
    
    return signedEvent;
  } catch (error) {
    console.error('Error creating and publishing event:', error);
    throw error;
  }
}; 