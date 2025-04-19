import { pool } from '../connection.js';
import { parseNaddr } from '../nip19.js';

/**
 * Fetch group metadata using the naddr string directly
 * @param {string} naddrString - The naddr to use
 * @returns {Promise<Object>} Group metadata
 */
export const fetchGroupMetadataByNaddr = async (naddrString) => {
  try {
    const groupInfo = parseNaddr(naddrString);
    if (!groupInfo) {
      throw new Error('Invalid naddr format');
    }
    
    // Add groups.0xchat.com as a primary relay for NIP-29 groups
    const groupRelays = [...new Set([
      'wss://groups.0xchat.com',
      ...(groupInfo.relays || [])
    ])];
    
    const filter = {
      kinds: [groupInfo.kind], // Typically 39000 for NIP-29 groups
      authors: [groupInfo.pubkey],
      '#d': [groupInfo.identifier]
    };
    
    console.log(`Fetching group metadata for ${naddrString} with filter:`, filter);
    console.log(`Using relays:`, groupRelays);
    
    const events = await pool.list(groupRelays, [filter]);
    
    if (!events || events.length === 0) {
      console.log(`No metadata found for group ${naddrString}`);
      return null;
    }
    
    // Sort by created_at in descending order to get the latest
    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
    
    // Parse the content which contains the group metadata
    let metadata;
    try {
      metadata = JSON.parse(latestEvent.content);
    } catch (e) {
      console.error('Error parsing group metadata content:', e);
      metadata = { name: 'Unknown Group', about: 'Could not parse group metadata' };
    }
    
    return {
      id: latestEvent.id,
      pubkey: latestEvent.pubkey,
      created_at: latestEvent.created_at,
      kind: latestEvent.kind,
      tags: latestEvent.tags,
      metadata
    };
  } catch (error) {
    console.error('Error fetching group metadata by naddr:', error);
    return null;
  }
};

/**
 * Fetch group metadata using kind, pubkey, and identifier
 * @param {number} kind - The kind of the group (typically 39000)
 * @param {string} pubkey - The group creator's pubkey
 * @param {string} identifier - The group identifier
 * @param {string[]} groupRelays - Relays to query
 * @returns {Promise<Object>} Group metadata
 */
export const fetchGroupMetadata = async (kind, pubkey, identifier, groupRelays = ['wss://groups.0xchat.com']) => {
  try {
    const filter = {
      kinds: [kind],
      authors: [pubkey],
      '#d': [identifier]
    };
    
    console.log(`Fetching group metadata with filter:`, filter);
    console.log(`Using relays:`, groupRelays);
    
    const events = await pool.list(groupRelays, [filter]);
    
    if (!events || events.length === 0) {
      console.log(`No metadata found for group kind=${kind}, pubkey=${pubkey}, identifier=${identifier}`);
      return null;
    }
    
    // Sort by created_at in descending order to get the latest
    const latestEvent = events.sort((a, b) => b.created_at - a.created_at)[0];
    
    // Parse the content which contains the group metadata
    let metadata;
    try {
      metadata = JSON.parse(latestEvent.content);
    } catch (e) {
      console.error('Error parsing group metadata content:', e);
      metadata = { name: 'Unknown Group', about: 'Could not parse group metadata' };
    }
    
    return {
      id: latestEvent.id,
      pubkey: latestEvent.pubkey,
      created_at: latestEvent.created_at,
      kind: latestEvent.kind,
      tags: latestEvent.tags,
      metadata
    };
  } catch (error) {
    console.error('Error fetching group metadata:', error);
    return null;
  }
}; 