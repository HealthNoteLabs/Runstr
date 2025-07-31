import { ndk, ndkReadyPromise } from '../lib/ndkSingleton';
import { nip19 } from 'nostr-tools';
import { NDKEvent, NDKRelaySet } from '@nostr-dev-kit/ndk';
import { ensureRelays } from './relays.js';

// Added for Hybrid Approach (Phase 3)
import { fetchEventsViaWebSocket } from './wsFetch.js';

// PHASE 7: In-memory cache for group metadata
const metadataCache = new Map();

/**
 * Parse a NIP19 naddr string to extract group components
 * @param {string} naddrString - The naddr string to parse
 * @returns {Object|null} Parsed group data or null if invalid
 */
export const parseNaddr = (naddrString) => {
  try {
    if (!naddrString) {
      console.error('No naddr string provided to parseNaddr');
      return null;
    }
    
    // Phase 0 Logging
    console.log(`ndkGroups.js: Attempting to parse naddr string: ${naddrString ? naddrString.substring(0, 30) : 'undefined'}...`);
    
    const { type, data } = nip19.decode(naddrString);
    // Phase 0 Logging
    console.log('ndkGroups.js: Decoded naddr data:', { type, data });
    
    if (type !== 'naddr' || !data) {
      console.error('Invalid naddr format - expected type "naddr"');
      return null;
    }
    
    const result = {
      kind: data.kind,
      pubkey: data.pubkey,
      rawGroupId: data.identifier, // Explicitly named raw 'd' or 'h' tag value
      relays: data.relays || [],
      naddr: naddrString          // Store the original full naddr string
    };
    
    // Phase 0 Logging
    console.log('ndkGroups.js: Successfully parsed naddr to:', result);
    return result;
  } catch (error) {
    console.error('Error parsing naddr:', error);
    console.error('Problematic naddr string:', naddrString);
    return null;
  }
};

/**
 * Gets the raw group ID from an naddr string or returns the input if it's likely already a raw ID.
 * @param {string} naddrOrRawId - The naddr string or a raw group ID.
 * @returns {string|null} The raw group ID or null if parsing fails or input is invalid.
 */
export const getRawGroupId = (naddrOrRawId) => {
  if (!naddrOrRawId || typeof naddrOrRawId !== 'string') {
    console.error('getRawGroupId: Input is null, undefined, or not a string.');
    return null;
  }
  // Attempt to parse as naddr first
  if (naddrOrRawId.startsWith('naddr1')) {
    const parsed = parseNaddr(naddrOrRawId);
    return parsed ? parsed.rawGroupId : null;
  }
  // Otherwise, assume it's already a raw ID.
  // Basic sanity check: a nostr ID is usually a 64-char hex string.
  // This is not a foolproof validation but a simple heuristic.
  if (naddrOrRawId.length === 64 && /^[a-f0-9]+$/.test(naddrOrRawId)) {
     // console.log(`getRawGroupId: Assuming input is already a raw ID: ${naddrOrRawId}`);
    return naddrOrRawId;
  }
  // It could also be a non-hex custom identifier used in '#d' or '#h' tags.
  // For now, if it's not an naddr and not a 64-char hex, we'll return it as is if it's non-empty.
  // More robust validation might be needed depending on how raw group IDs are structured in practice.
  if (naddrOrRawId.length > 0) {
    // console.log(`getRawGroupId: Input is not naddr1 or 64-char hex, returning as is: ${naddrOrRawId}`);
    return naddrOrRawId; 
  }
  console.warn(`getRawGroupId: Input '${naddrOrRawId}' does not look like naddr1 or a typical raw ID.`);
  return null; 
};

/**
 * Fetch group metadata using NDK and fallback to direct WebSocket if needed.
 * @param {string} naddrString - The naddr to use
 * @returns {Promise<Object|null>} Group metadata event object (rawEvent structure) or null
 */
export const fetchGroupMetadataByNaddr = async (naddrString) => {
  // PHASE 7: Check cache first
  if (metadataCache.has(naddrString)) {
    // console.log(`[ndkGroups] fetchGroupMetadataByNaddr: Cache HIT for naddr: ${naddrString}`);
    return metadataCache.get(naddrString);
  }

  // console.log(`[ndkGroups] fetchGroupMetadataByNaddr: Cache MISS for naddr: ${naddrString}. Fetching (NDK attempt)...`);
  const parsedInfo = parseNaddr(naddrString);
  if (!parsedInfo) {
    console.error('fetchGroupMetadataByNaddr: Failed to parse naddr string.');
    return null;
  }

  const { kind, pubkey, rawGroupId: identifier, relays: relayHints } = parsedInfo;
  console.log(`ndkGroups: Parsed naddr for NDK metadata - Kind: ${kind}, Pubkey: ${pubkey}, Identifier (d tag): ${identifier}, Hints: ${relayHints}`);
  
  await ensureRelays(relayHints); // Ensure NDK knows about these relays

  const filter = {
    kinds: [39000],
    authors: [pubkey],
    '#d': [identifier],
    limit: 1,
  };
  
  const fetchOpts = {};
  if (relayHints && relayHints.length > 0) {
    fetchOpts.relaySet = NDKRelaySet.fromRelayUrls(relayHints, ndk);
    console.log('fetchGroupMetadataByNaddr (NDK): Using explicit relaySet from hints.');
  } else {
    console.log('fetchGroupMetadataByNaddr (NDK): No relay hints, using NDK default pool behavior.');
  }

  try {
    console.log('fetchGroupMetadataByNaddr (NDK): Attempting ndk.fetchEvent with filter:', JSON.stringify(filter), 'FetchOpts:', fetchOpts);
    const metadataEvent = await ndk.fetchEvent(filter, fetchOpts);

    if (metadataEvent) {
      console.log('ndkGroups: Found metadata event via NDK:', metadataEvent.rawEvent());
      let metadata = {};
      if (metadataEvent.content && metadataEvent.content.trim() !== '') {
        try { metadata = JSON.parse(metadataEvent.content); } catch (e) { console.error('Error parsing NDK metadata content:', e); }
      }
      if (Object.keys(metadata).length === 0 && metadataEvent.tags && metadataEvent.tags.length > 0) {
        metadataEvent.tags.forEach(tag => {
          if (tag.length >= 2) {
            const [tagName, tagValue] = tag;
            if (tagName === 'name') metadata.name = tagValue;
            if (tagName === 'about') metadata.about = tagValue;
            if (tagName === 'picture') metadata.picture = tagValue;
          }
        });
      }
      if (Object.keys(metadata).length === 0) {
        metadata = { name: `Group ${identifier.substring(0, 8)}...`, about: 'No description (NDK)' };
      }
      const resultToCacheNdk = { ...metadataEvent.rawEvent(), metadata };
      metadataCache.set(naddrString, resultToCacheNdk); // PHASE 7: Cache successful NDK result
      return resultToCacheNdk;
    }
    console.warn('ndkGroups: No metadata event found via NDK. Filter:', filter, 'RelaySet used:', fetchOpts.relaySet ? Array.from(fetchOpts.relaySet.relays).map(r=>r.url) : 'default pool');
  } catch (ndkError) {
    console.error('ndkGroups: Error fetching metadata via NDK:', ndkError, 'Filter:', filter);
  }

  // NDK attempt failed or returned null, try direct WebSocket fallback
  console.log(`ndkGroups: NDK fetch failed for ${naddrString}. Attempting direct WebSocket fallback.`);
  
  // Determine relays to try for WebSocket: primary hint or groups.0xchat.com, then other hints
  const wsRelaysToTry = [];
  if (relayHints && relayHints.length > 0) {
    wsRelaysToTry.push(...relayHints);
  }
  if (!wsRelaysToTry.includes('wss://groups.0xchat.com')) {
    wsRelaysToTry.unshift('wss://groups.0xchat.com'); // Prioritize this one
  }

  for (const relayUrl of [...new Set(wsRelaysToTry)]) { // Ensure unique relays
    console.log(`fetchGroupMetadataByNaddr (WS Fallback): Trying relay ${relayUrl}`);
    try {
      const metadata = await new Promise((resolve, reject) => {
        const ws = new WebSocket(relayUrl);
        let timeoutId = null;
        let eventReceived = null;

        ws.onopen = () => {
          console.log(`fetchGroupMetadataByNaddr (WS Fallback): Connected to ${relayUrl}, sending REQ for metadata`);
          const req = ['REQ', `metadata-fallback-${identifier.substring(0,8)}-${Date.now()}` , filter];
          ws.send(JSON.stringify(req));
          timeoutId = setTimeout(() => {
            if (!eventReceived) {
                console.warn(`fetchGroupMetadataByNaddr (WS Fallback): Timeout on ${relayUrl}`);
                ws.close();
                reject(new Error(`Timeout on ${relayUrl}`));
            }
          }, 7000); // 7-second timeout for WebSocket attempt
        };

        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data.toString());
          if (msg[0] === 'EVENT' && msg[2]) {
            console.log(`fetchGroupMetadataByNaddr (WS Fallback): EVENT from ${relayUrl}:`, msg[2]);
            eventReceived = msg[2]; // Store the event data
            // Don't close immediately, wait for EOSE or rely on timeout to gather potential duplicates (though limit:1)
          } else if (msg[0] === 'EOSE') {
            console.log(`fetchGroupMetadataByNaddr (WS Fallback): EOSE from ${relayUrl}`);
            clearTimeout(timeoutId);
            ws.close();
            if (eventReceived) resolve(eventReceived);
            else reject(new Error('EOSE without EVENT on WS fallback'));
          }
        };

        ws.onerror = (err) => {
          console.error(`fetchGroupMetadataByNaddr (WS Fallback): Error with ${relayUrl}:`, err.message || err);
          clearTimeout(timeoutId);
          reject(new Error(`WebSocket error on ${relayUrl}`));
        };
        ws.onclose = () => {
          clearTimeout(timeoutId);
          if (!eventReceived) {
            // If it closed without an event and reject wasn't called by timeout/error/eose
            reject(new Error(`WebSocket closed without event on ${relayUrl}`));
          }
        };
      });

      if (metadata) {
        console.log('ndkGroups: Found metadata event via Direct WebSocket:', metadata);
        let parsedContent = {};
        if (metadata.content && metadata.content.trim() !== '') {
            try { parsedContent = JSON.parse(metadata.content); } catch (e) { console.error('Error parsing WS metadata content:', e); }
        }
        if (Object.keys(parsedContent).length === 0 && metadata.tags && metadata.tags.length > 0) {
            metadata.tags.forEach(tag => {
                if (tag.length >= 2) {
                    const [tagName, tagValue] = tag;
                    if (tagName === 'name') parsedContent.name = tagValue;
                    if (tagName === 'about') parsedContent.about = tagValue;
                    if (tagName === 'picture') parsedContent.picture = tagValue;
                }
            });
        }
        if (Object.keys(parsedContent).length === 0) {
            parsedContent = { name: `Group ${identifier.substring(0, 8)}...`, about: 'No description (WS)' };
        }
        const resultToCacheWs = { ...metadata, metadata: parsedContent };
        metadataCache.set(naddrString, resultToCacheWs); // PHASE 7: Cache successful WS fallback result
        return resultToCacheWs;
      }
    } catch (wsError) {
      console.log(`fetchGroupMetadataByNaddr (WS Fallback): Failed for relay ${relayUrl}: ${wsError.message}`);
      // Continue to next relay if error
    }
  }

  console.error(`fetchGroupMetadataByNaddr: All attempts (NDK & WS Fallback) failed for ${naddrString}.`);
  return null; // All attempts failed
};

/**
 * Fetch past messages for a NIP-29 group using a hybrid NDK/WebSocket approach.
 * Attempts NDK fetch first, then falls back to direct WebSocket.
 * @param {string} rawGroupId - The raw group identifier ('h' tag value).
 * @param {object} [options={}] - Options for fetching.
 * @param {number} [options.limit=50] - Max number of messages to fetch.
 * @param {string[]} [options.relays=[]] - Optional array of relay hints.
 * @param {Array<number|string>} [options.kinds=[9, 39001]] - Kinds to fetch.
 * @param {number} [options.since] - Nostr filter since.
 * @param {number} [options.until] - Nostr filter until.
 * @returns {Promise<NDKEvent[]>} Array of NDKEvent objects, sorted newest first.
 */
export const fetchGroupMessages = async (rawGroupId, options = {}) => {
    const { limit = 50, relays: relayHints = [], kinds = [9, 39001], since, until } = options;
    const NDK_FETCH_TIMEOUT_MS = 4000;

    // console.log(`[ndkGroups] fetchGroupMessages (Hybrid - REAPPLIED): Fetching for rawGroupId: ${rawGroupId}, limit: ${limit}, hints:`, relayHints);

    if (!rawGroupId) {
        console.error('[ndkGroups] fetchGroupMessages: rawGroupId is required.');
        return [];
    }

    if (relayHints && relayHints.length > 0) {
      await ensureRelays(relayHints);
    }

    const filter = { kinds: kinds, '#h': [rawGroupId], limit: Number(limit) }; // Ensure limit is a number
    if (since) filter.since = since;
    if (until) filter.until = until;
    
    let events = [];

    try {
        // console.log(`[ndkGroups] fetchGroupMessages: Attempting NDK fetch with filter:`, filter);
        
        const ndkFetchPromise = ndk.fetchEvents(
            filter, 
            { closeOnEose: true }, 
            relayHints.length > 0 ? NDKRelaySet.fromRelayUrls(relayHints, ndk) : undefined 
        );
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('NDK fetch timed out')), NDK_FETCH_TIMEOUT_MS)
        );

        const ndkResult = await Promise.race([ndkFetchPromise, timeoutPromise]);
        
        if (ndkResult && ndkResult.size > 0) { // ndk.fetchEvents returns a Set
            events = Array.from(ndkResult);
            // console.log(`[ndkGroups] fetchGroupMessages: NDK fetch successful, found ${events.length} events.`);
        } else {
            // console.log('[ndkGroups] fetchGroupMessages: NDK fetch returned no events or timed out. Falling back to WebSocket.');
            events = await fetchEventsViaWebSocket(filter, relayHints, 5000, Number(limit)); // Ensure limit is number
            // console.log(`[ndkGroups] fetchGroupMessages: WebSocket fallback fetched ${events.length} events.`);
        }
    } catch (ndkError) {
        console.warn('[ndkGroups] fetchGroupMessages: NDK fetch attempt failed. Error:', ndkError.message, 'Falling back to WebSocket.');
        try {
            events = await fetchEventsViaWebSocket(filter, relayHints, 5000, Number(limit)); // Ensure limit is number
            // console.log(`[ndkGroups] fetchGroupMessages: WebSocket fallback (after NDK error) fetched ${events.length} events.`);
        } catch (wsError) {
            console.error('[ndkGroups] fetchGroupMessages: WebSocket fallback also failed:', wsError);
            return [];
        }
    }
    
    const finalEvents = events.map(ev => {
        if (!(ev instanceof NDKEvent) && ev.kind !== undefined) {
            const ndkEvent = new NDKEvent(ndk);
            Object.assign(ndkEvent, ev);
            ndkEvent.id = ev.id;
            ndkEvent.signature = ev.sig;
            return ndkEvent;
        }
        return ev;
    });

    return finalEvents.sort((a, b) => b.created_at - a.created_at);
};

/**
 * Subscribe to real-time messages for a NIP-29 group.
 * Relies on NDK if it's ready.
 * @param {string} rawGroupId - The group identifier ('h' tag value).
 * @param {(event: NDKEvent) => void} onEventCallback - Callback function for new messages.
 * @param {object} [options={}] - Options for subscription.
 * @param {string[]} [options.relays=[]] - Optional array of relay hints.
 * @param {Array<number|string>} [options.kinds=[9, 39001]] - Kinds to subscribe to.
 * @param {number} [options.since] - Nostr filter since (e.g., Date.now()/1000). If not provided, NDK default behavior.
 * @returns {Promise<import('@nostr-dev-kit/ndk').NDKSubscription | {unsub: () => void} | null>} The NDK subscription or a mock unsub object.
 */
export const subscribeToGroupMessages = async (rawGroupId, onEventCallback, options = {}) => {
    const { relays: relayHints = [], kinds = [9, 39001], since } = options;
    // console.log(`[ndkGroups] subscribeToGroupMessages (Hybrid REAPPLIED): Attempting for rawGroupId: ${rawGroupId}, hints:`, relayHints);

    if (!rawGroupId) {
        console.error('[ndkGroups] subscribeToGroupMessages: rawGroupId is required.');
        return null;
    }

    try {
        const isNdkTrulyReady = await ndkReadyPromise;
        const connectedRelaysCount = ndk.pool.stats().connected;

        if (!isNdkTrulyReady || connectedRelaysCount === 0) {
            console.warn(`[ndkGroups] subscribeToGroupMessages: NDK not ready or no connected relays (promise: ${isNdkTrulyReady}, connected: ${connectedRelaysCount}). NDK subscription will not be attempted now. Fallback WS subscription is NOT implemented in this step.`);
            return {
                unsub: () => console.log('[ndkGroups] Unsub called on a non-NDK subscription (NDK was not ready or connected).')
            };
        }
        
        if (relayHints && relayHints.length > 0) {
            await ensureRelays(relayHints);
        }

        const filter = { kinds: kinds, '#h': [rawGroupId] };
        if (since) {
            filter.since = since;
        } else {
            // console.log('[ndkGroups] subscribeToGroupMessages: `since` not provided, NDK will use its default for fetching recent on subscribe.');
        }
        
        // console.log('[ndkGroups] subscribeToGroupMessages: NDK is ready. Subscribing with filter:', filter);
        const relaySet = relayHints.length > 0 ? NDKRelaySet.fromRelayUrls(relayHints, ndk) : undefined;
        
        const sub = ndk.subscribe(filter, { closeOnEose: false }, relaySet);

        sub.on('event', (event) => {
            onEventCallback(event);
        });
        sub.on('eose', () => {
            // console.log(`[ndkGroups] subscribeToGroupMessages: Received EOSE for ${rawGroupId}`);
        });
        
        // console.log(`[ndkGroups] NDK Subscription created for group ${rawGroupId}`);
        return sub; 
    } catch (error) {
        console.error(`[ndkGroups] subscribeToGroupMessages: Error setting up NDK subscription for ${rawGroupId}:`, error);
        return {
            unsub: () => console.log('[ndkGroups] Unsub called on a failed NDK subscription attempt.')
        };
    }
};

/**
 * Send a message to a NIP-29 group
 * @param {string} groupId - The group identifier ('d' tag value)
 * @param {string} content - Message content
 * @returns {Promise<object|null>} The raw published event object or null on failure
 *
 * According to NIP-29, a real-time group chat message SHOULD be event kind 9 with
 * an `h` tag that contains the group identifier. Other kinds (11/12, 10) are
 * reserved for threaded/grouped use-cases. We therefore set `kind = 9`.
 */
export const sendGroupMessage = async (groupId, content, options = {}) => {
  const { relays: relayHints /*, tags = []*/ } = options; // Comment out or remove unused 'tags' destructuring
  // console.log(`[ndkGroups] sendGroupMessage: Sending to rawGroupId: ${rawGroupId}, Relays: ${JSON.stringify(relayHints)}`);

  if (!ndk) {
    console.error('[ndkGroups] sendGroupMessage: NDK instance not available.');
    throw new Error('NDK not available');
  }
  if (!ndk.signer) {
    console.error('[ndkGroups] sendGroupMessage: NDK signer not available. User might not be logged in or extension not connected.');
    throw new Error('Nostr key not connected or signer unavailable.');
  }

  if (relayHints && relayHints.length > 0) {
    await ensureRelays(relayHints);
  }

  const event = new NDKEvent(ndk);
  try {
    console.log(`ndkGroups: Sending chat message to group ID: ${groupId} (Kind 9)`);
    const user = await ndk.signer.user();
    if (!user || !user.pubkey) {
        throw new Error('Cannot send message: Unable to get user pubkey from signer.');
    }
    const userPubkey = user.pubkey;
    
    // Create a Kind 9 "Group Chat Message" event as per NIP-29
    event.kind = 9; // NIP-29 chat message kind
    event.content = content;
    event.tags = [
        ['h', groupId],
        ['p', userPubkey] // Add sender's pubkey as 'p' tag
    ];
    
    // Sign and publish the event
    // NDK's publish method handles signing and sending to connected relays
    await event.publish(); 
    
    console.log(`ndkGroups: Message published successfully for group ${groupId}. Event ID: ${event.id}`);
    return event.rawEvent(); // Return the raw event data

  } catch (error) {
    console.error(`ndkGroups: Error sending message to group ${groupId}:`, error);
    return null;
  }
};

/**
 * Check if a user is currently a member of a NIP-29 group.
 * Fetches the latest AddMember (9002) or RemoveMember (9003) event targeting the user for the group.
 * Assumes relays correctly store/serve these kinds and the latest event reflects current status.
 * @param {string} groupId - The group identifier ('d' tag value).
 * @param {string} pubkey - The public key of the user to check.
 * @returns {Promise<boolean>} True if the latest relevant event is Kind 9002 (AddMember), false otherwise.
 */
export const isMember = async (groupId, pubkey) => {
  try {
    console.log(`ndkGroups: Checking membership (Kind 9002/9003) for pubkey ${pubkey} in group ${groupId}`);
    const filter = {
      kinds: [9002, 9003], // Only check AddMember and RemoveMember
      '#h': [groupId],
      '#p': [pubkey],
      limit: 1, // latest event only
    };

    const latestEvent = await ndk.fetchEvent(filter, {
      subTimeout: 4000, // Adjusted timeout
      eoseTimeout: 7000,
    });

    if (!latestEvent) {
      console.log(`ndkGroups: No specific membership events (9002/9003) found for ${pubkey} in group ${groupId}. Assuming open group membership.`);
      return true; // Assume membership if no explicit add/remove found
    }

    console.log(`ndkGroups: Latest membership event kind ${latestEvent.kind} for ${pubkey} in group ${groupId}`);

    // If the latest is AddMember (9002), they are a member. Otherwise (9003), they are not.
    return latestEvent.kind === 9002; 
  } catch (error) {
    console.error(`ndkGroups: Error checking membership for ${pubkey} in group ${groupId}:`, error);
    return true; // Default to allowing access on error during check
  }
};

// Helper to fetch the group metadata event (assumes Kind 39000)
async function getGroupMetadataEvent(groupId) {
  const filter = { kinds: [39000], '#d': [groupId], limit: 1 };
  return await ndk.fetchEvent(filter, { 
      subTimeout: 5000, 
      eoseTimeout: 8000 
  });
}

/**
 * Check if a pubkey is an admin of a group.
 * Currently, defines admin as the original creator of the group (author of Kind 39000).
 * TODO: Enhance to check for Kind 9001 admin events.
 * @param {string} groupId - The group identifier ('d' tag value).
 * @param {string} pubkeyToCheck - The public key to check for admin status.
 * @returns {Promise<boolean>} True if the pubkey is the group creator, false otherwise.
 */
export const isGroupAdmin = async (groupId, pubkeyToCheck) => {
  try {
    console.log(`ndkGroups: Checking admin status for ${pubkeyToCheck} in group ${groupId}`);
    const metadataEvent = await getGroupMetadataEvent(groupId);
    
    if (!metadataEvent) {
      console.warn(`ndkGroups: Could not find metadata event for group ${groupId} to check admin status.`);
      return false; // Cannot determine admin if metadata is missing
    }

    // Simple check: is the user the author of the group creation event?
    const isAdmin = metadataEvent.pubkey === pubkeyToCheck;
    console.log(`ndkGroups: Admin status for ${pubkeyToCheck} is ${isAdmin} (based on creator)`);
    return isAdmin;

  } catch (error) {
    console.error(`ndkGroups: Error checking admin status for ${pubkeyToCheck} in group ${groupId}:`, error);
    return false;
  }
};

/**
 * Add a member to a NIP-29 group (requires admin privileges).
 * Publishes a Kind 9002 (AddMember) event.
 * @param {string} groupId - The group identifier ('d' tag value).
 * @param {string} targetPubkey - The public key of the user to add.
 * @param {string} [role='member'] - Optional role for the member.
 * @param {string} [reason=''] - Optional reason for adding.
 * @returns {Promise<object|null>} The raw published event object or null on failure.
 */
export const addMember = async (groupId, targetPubkey, role = 'member', reason = '') => {
  try {
    console.log(`ndkGroups: Attempting to add member ${targetPubkey} to group ${groupId}`);
    if (!ndk.signer) {
      throw new Error('Cannot add member: No signer available in NDK.');
    }
    const signerPubkey = await ndk.signer.user().then(u => u.pubkey);

    // Check admin privileges
    const isAdmin = await isGroupAdmin(groupId, signerPubkey);
    if (!isAdmin) {
       console.warn(`ndkGroups: Signer ${signerPubkey} is not an admin of group ${groupId}. Add member action denied.`);
       throw new Error('Permission denied: Only group admins can add members.');
    }

    // Check if target is already a member to avoid redundant events
    const alreadyMember = await isMember(groupId, targetPubkey);
    if (alreadyMember) {
        console.log(`ndkGroups: User ${targetPubkey} is already a member of group ${groupId}. Skipping addMember event.`);
        return null; // Or return a specific indicator? For now, null signifies no event published.
    }

    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = 9002; // AddMember
    ndkEvent.tags = [
      ['h', groupId],
      ['p', targetPubkey, role] // Tag the user being added with optional role
    ];
    ndkEvent.content = reason || `Adding ${targetPubkey.substring(0,8)}... as ${role}`; 

    await ndkEvent.publish();
    console.log(`ndkGroups: Published AddMember event (Kind 9002) for ${targetPubkey} in group ${groupId}. Event ID: ${ndkEvent.id}`);
    return ndkEvent.rawEvent();

  } catch (error) {
    console.error(`ndkGroups: Error adding member ${targetPubkey} to group ${groupId}:`, error);
    // Re-throw permission errors so UI can catch them
    if (error.message.startsWith('Permission denied')) {
        throw error;
    }
    return null;
  }
};

/**
 * Remove a member from a NIP-29 group (requires admin privileges or self-removal).
 * Publishes a Kind 9003 (RemoveMember) event.
 * @param {string} groupId - The group identifier ('d' tag value).
 * @param {string} targetPubkey - The public key of the user to remove.
 * @param {string} [reason=''] - Optional reason for removal.
 * @returns {Promise<object|null>} The raw published event object or null on failure.
 */
export const removeMember = async (groupId, targetPubkey, reason = '') => {
  try {
    console.log(`ndkGroups: Attempting to remove member ${targetPubkey} from group ${groupId}`);
    if (!ndk.signer) {
      throw new Error('Cannot remove member: No signer available in NDK.');
    }
    const signerPubkey = await ndk.signer.user().then(u => u.pubkey);

    // Check if user is removing themselves OR if signer is an admin
    const isSelfRemoval = signerPubkey === targetPubkey;
    const isAdmin = await isGroupAdmin(groupId, signerPubkey);

    if (!isSelfRemoval && !isAdmin) {
      console.warn(`ndkGroups: Signer ${signerPubkey} is not an admin of group ${groupId} and not removing self. Action denied.`);
      throw new Error('Permission denied: Only group admins or the user themselves can remove a member.');
    }

    // Check if target is actually a member before removing
    const isCurrentlyMember = await isMember(groupId, targetPubkey);
    if (!isCurrentlyMember) {
        console.log(`ndkGroups: User ${targetPubkey} is not currently a member of group ${groupId}. Skipping removeMember event.`);
        return null;
    }

    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = 9003; // RemoveMember
    ndkEvent.tags = [
      ['h', groupId],
      ['p', targetPubkey] // Tag the user being removed
    ];
    ndkEvent.content = reason || `Removing ${targetPubkey.substring(0,8)}...`; 

    await ndkEvent.publish();
    console.log(`ndkGroups: Published RemoveMember event (Kind 9003) for ${targetPubkey} in group ${groupId}. Event ID: ${ndkEvent.id}`);
    return ndkEvent.rawEvent();

  } catch (error) {
    console.error(`ndkGroups: Error removing member ${targetPubkey} from group ${groupId}:`, error);
    // Re-throw permission errors
    if (error.message.startsWith('Permission denied')) {
        throw error;
    }
    return null;
  }
};

// TODO: Add functions for group creation (Kind 39000) and admin management (Kind 9001, etc.)

// --- New helper: joinGroup (now uses Kind 9002 for self-add in open groups) ---
export const joinGroup = async (groupId, reason = '') => {
  try {
    console.log(`ndkGroups: Publishing self-add (Kind 9002) for group ${groupId}`);
    if (!ndk.signer) {
      throw new Error('Cannot join group: No signer available in NDK.');
    }
    const selfPubkey = (await ndk.signer.user()).pubkey;
    
    // Check if already a member to avoid redundant events
    const alreadyMember = await isMember(groupId, selfPubkey);
    if (alreadyMember) {
        console.log(`ndkGroups: User ${selfPubkey} is already a member of group ${groupId}. Skipping joinGroup event.`);
        return null; 
    }

    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = 9002; // AddMember (self-add for open groups)
    ndkEvent.tags = [
        ['h', groupId],
        ['p', selfPubkey, 'member'] // Tag self as member
    ];
    ndkEvent.content = reason || 'Self-added to group';

    await ndkEvent.publish();
    console.log(`ndkGroups: Self-AddMember (Kind 9002) published for group ${groupId}. Event ID: ${ndkEvent.id}`);
    return ndkEvent.rawEvent();
  } catch (error) {
    console.error(`ndkGroups: Error publishing self-add for group ${groupId}:`, error);
    return null;
  }
};

// ---------- ONE-OFF GROUP CREATION/UPDATE UTILITY ----------
/**
 * Publishes a spec-compliant Kind 39000 group metadata event.
 * Stores metadata (name, about, picture) in the content field as JSON.
 * Uses 'd' and 'h' tags for identifier, and optional 'relay' tags.
 * @param {object} params
 * @param {string} params.identifier - The unique group identifier (d tag value).
 * @param {string} params.name - The group name.
 * @param {string} params.about - The group description.
 * @param {string} params.picture - URL for the group picture.
 * @param {string[]} [params.relays=[]] - Optional array of relay URLs to include as hints.
 * @returns {Promise<object|null>} The raw published event object or null on failure.
 */
export const publishGroupMetadata = async ({
  identifier,
  name,
  about,
  picture,
  relays = [],
}) => {
  try {
    console.log(`ndkGroups: Publishing Kind 39000 for identifier: ${identifier}`);
    if (!ndk.signer) {
      throw new Error('Cannot publish metadata: No signer available in NDK.');
    }
    const metadata = { name, about, picture };
    const contentJson = JSON.stringify(metadata);

    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.kind = 39000;
    ndkEvent.tags = [
      ['d', identifier],
      ['h', identifier], // Often redundant but sometimes used for indexing
      ...relays.map(r => ['relay', r])
    ];
    ndkEvent.content = contentJson; 

    await ndkEvent.publish();
    console.log(`ndkGroups: Published Kind 39000 for ${identifier}. Event ID: ${ndkEvent.id}`);
    return ndkEvent.rawEvent();

  } catch (error) {
    console.error(`ndkGroups: Error publishing group metadata for ${identifier}:`, error);
    return null;
  }
};

/**
 * Add ensureMessagesForDebug function (from thought_7) if it's not there or ensure it is correct.
 * @param {string} rawGroupId - The raw group ID.
 * @param {string[]} [relayHints=[]] - Optional relay hints.
 * @returns {Promise<NDKEvent[]>}
 */
export const ensureMessagesForDebug = async (rawGroupId, relayHints = []) => {
    if (!rawGroupId) { 
        console.error("[ndkGroups] ensureMessagesForDebug: No rawGroupId provided."); 
        return []; 
    }
    // console.log(`[ndkGroups] ensureMessagesForDebug (REAPPLIED): Attempting to fetch messages for ${rawGroupId} using hybrid fetchGroupMessages. Hints:`, relayHints);
    try {
        const messages = await fetchGroupMessages(rawGroupId, { relays: relayHints, limit: 10 });
        // console.log(`[ndkGroups] ensureMessagesForDebug: Fetched ${messages.length} messages for ${rawGroupId}.`);
        if (messages.length > 0) {
            // console.log(`[ndkGroups] ensureMessagesForDebug: First message content (first 30 chars): "${messages[0]?.content?.substring(0,30)}", ID: ${messages[0]?.id}`);
        }
        return messages;
    } catch (error) {
        console.error(`[ndkGroups] ensureMessagesForDebug: Error fetching messages for ${rawGroupId}:`, error);
        return [];
    }
}; 