import { Relay, nip19 } from 'nostr-tools';

// A list of relays to try. In a real app, this might be user-configurable
// or a more robust, dynamically updated list.
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://nostr.wine',
  'wss://purplepag.es',
  'wss://relay.snort.social',
];

function isValidHexPubkey(pubkey: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(pubkey);
}

/**
 * Fetches the Lightning Address (lud16) or LNURL (lud06) from a user's Nostr profile (Kind 0).
 * @param pubkeyHexOrNpub The user's public key in hex or npub format.
 * @param relaysToTry An optional array of relay URLs.
 * @returns The lud16 or lud06 string if found, otherwise null.
 */
export async function fetchLnAddressFromProfile(
  pubkeyHexOrNpub: string,
  relaysToTry: string[] = DEFAULT_RELAYS
): Promise<string | null> {
  let pubkeyHex = pubkeyHexOrNpub;

  if (!isValidHexPubkey(pubkeyHexOrNpub)) {
    try {
      const decoded = nip19.decode(pubkeyHexOrNpub);
      if (decoded.type === 'npub') {
        pubkeyHex = decoded.data as string;
      } else {
        // console.error('[LN Resolver] Input is not a valid hex pubkey or npub:', pubkeyHexOrNpub);
        return null;
      }
    } catch (e) {
      // console.error('[LN Resolver] Error decoding pubkey/npub:', pubkeyHexOrNpub, e);
      return null;
    }
  }

  if (!isValidHexPubkey(pubkeyHex)) {
    // console.error('[LN Resolver] Decoded pubkey is not valid hex:', pubkeyHex);
    return null;
  }

  let latestKind0Event: any = null;

  // Try fetching from multiple relays and use the latest event found.
  const promises = relaysToTry.map(async (relayUrl) => {
    let relay: Relay | null = null;
    try {
      relay = new Relay(relayUrl);
      await relay.connect();

      return new Promise((resolveEvent, rejectEvent) => {
        let eventReceived = false;
        const sub = relay!.subscribe([
          {
            authors: [pubkeyHex],
            kinds: [0],
            limit: 1,
          },
        ]);

        const timeout = setTimeout(() => {
          sub.close();
          if (relay) relay.close();
          if (!eventReceived) {
            // console.debug(`[LN Resolver] Timeout fetching profile from ${relayUrl}`);
            rejectEvent(new Error(`Timeout fetching profile from ${relayUrl}`));
          }
        }, 3000); // 3-second timeout per relay

        sub.on('event', (event) => {
          eventReceived = true;
          clearTimeout(timeout);
          sub.close();
          if (relay) relay.close();
          resolveEvent(event);
        });
        sub.on('error', (errMsg: string) => {
            clearTimeout(timeout);
            sub.close();
            if (relay) relay.close();
            // console.warn(`[LN Resolver] Subscription error from ${relayUrl}: ${errMsg}`);
            rejectEvent(new Error(`Relay subscription error from ${relayUrl}: ${errMsg}`));
        });
         // EOSE might not always fire if limit:1 is hit first and sub is closed.
         sub.on('eose', () => {
            clearTimeout(timeout);
            sub.close();
            if (relay) relay.close();
            if (!eventReceived) {
                // console.debug(`[LN Resolver] EOSE from ${relayUrl}, no event found.`);
                resolveEvent(null); // Resolve with null if no event found before EOSE
            }
        });
      });
    } catch (error) {
      // console.warn(`[LN Resolver] Could not connect or fetch from ${relayUrl}:`, error);
      if (relay) relay.close();
      return null; // Return null if this relay fails
    }
  });

  const results = await Promise.allSettled(promises);
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      const event = result.value as any;
      if (!latestKind0Event || event.created_at > latestKind0Event.created_at) {
        latestKind0Event = event;
      }
    }
  });

  if (!latestKind0Event) {
    // console.warn(`[LN Resolver] No Kind 0 profile event found for pubkey ${pubkeyHex} after trying all relays.`);
    return null;
  }

  try {
    const profileContent = JSON.parse(latestKind0Event.content);
    if (profileContent.lud16 && typeof profileContent.lud16 === 'string' && profileContent.lud16.trim() !== '') {
      return profileContent.lud16.trim(); // Preferred: Lightning Address
    }
    if (profileContent.lud06 && typeof profileContent.lud06 === 'string' && profileContent.lud06.trim() !== '') {
      return profileContent.lud06.trim(); // Fallback: LNURL-pay
    }
    // console.warn(`[LN Resolver] No lud16 or lud06 found in profile for ${pubkeyHex}`);
    return null;
  } catch (e) {
    // console.error(`[LN Resolver] Error parsing Kind 0 content for ${pubkeyHex}:`, e);
    return null;
  }
}

/**
 * Fetches multiple Lightning Addresses from a user's Nostr profile (Kind 0).
 * It prioritizes `lud16`, then looks for an array `lightning_addresses`,
 * and can include `lud06` as a fallback if no `lud16` is found.
 * @param pubkeyHexOrNpub The user's public key in hex or npub format.
 * @param relaysToTry An optional array of relay URLs.
 * @returns An array of Lightning address strings. Empty if none found or on error.
 */
export async function fetchLnAddressesFromProfile(
  pubkeyHexOrNpub: string,
  relaysToTry: string[] = DEFAULT_RELAYS
): Promise<string[]> {
  let pubkeyHex: string;

  if (isValidHexPubkey(pubkeyHexOrNpub)) {
    pubkeyHex = pubkeyHexOrNpub;
  } else {
    try {
      const decoded = nip19.decode(pubkeyHexOrNpub);
      if (decoded.type === 'npub' && typeof decoded.data === 'string') {
        pubkeyHex = decoded.data;
      } else {
        // console.error('[LN Resolver Multi] Input is not a valid npub, or decoded data is not a string:', pubkeyHexOrNpub);
        return [];
      }
    } catch (e) {
      // console.error('[LN Resolver Multi] Error decoding npub:', pubkeyHexOrNpub, e);
      return [];
    }
  }

  // At this point, pubkeyHex should be a valid hex string or the function would have returned.
  // We can add an explicit check for safety, though it's logically covered.
  if (!isValidHexPubkey(pubkeyHex)) {
    // console.error('[LN Resolver Multi] Internal error: pubkeyHex is not valid hex after processing:', pubkeyHex);
    return []; 
  }

  let latestKind0Event: any = null;

  const promises = relaysToTry.map(async (relayUrl) => {
    let relay: Relay | null = null;
    try {
      relay = new Relay(relayUrl);
      await relay.connect();

      return new Promise((resolveEvent, rejectEvent) => {
        let eventReceived = false;
        const sub = relay!.subscribe([
          {
            authors: [pubkeyHex],
            kinds: [0],
            limit: 1,
          },
        ]);

        const timeout = setTimeout(() => {
          sub.close();
          if (relay) relay.close();
          if (!eventReceived) {
            // console.debug(`[LN Resolver Multi] Timeout fetching profile from ${relayUrl}`);
            rejectEvent(new Error(`Timeout fetching profile from ${relayUrl}`));
          }
        }, 3000);

        sub.on('event', (event) => {
          eventReceived = true;
          clearTimeout(timeout);
          sub.close();
          if (relay) relay.close();
          resolveEvent(event);
        });
        sub.on('error', (errMsg: string) => {
            clearTimeout(timeout);
            sub.close();
            if (relay) relay.close();
            // console.warn(`[LN Resolver Multi] Subscription error from ${relayUrl}: ${errMsg}`);
            rejectEvent(new Error(`Relay subscription error from ${relayUrl}: ${errMsg}`));
        });
         sub.on('eose', () => {
            clearTimeout(timeout);
            sub.close();
            if (relay) relay.close();
            if (!eventReceived) {
                // console.debug(`[LN Resolver Multi] EOSE from ${relayUrl}, no event found.`);
                resolveEvent(null); 
            }
        });
      });
    } catch (error) {
      // console.warn(`[LN Resolver Multi] Could not connect or fetch from ${relayUrl}:`, error);
      if (relay) relay.close();
      return null; 
    }
  });

  const results = await Promise.allSettled(promises);
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value) {
      const event = result.value as any;
      if (!latestKind0Event || event.created_at > latestKind0Event.created_at) {
        latestKind0Event = event;
      }
    }
  });

  if (!latestKind0Event) {
    // console.warn(`[LN Resolver Multi] No Kind 0 profile event found for pubkey ${pubkeyHex} after trying all relays.`);
    return [];
  }

  const allAddresses: string[] = [];
  try {
    const profileContent = JSON.parse(latestKind0Event.content);
    let primaryLud16: string | null = null;

    if (profileContent.lud16 && typeof profileContent.lud16 === 'string' && profileContent.lud16.trim() !== '') {
      primaryLud16 = profileContent.lud16.trim();
      allAddresses.push(primaryLud16);
    }

    if (profileContent.lightning_addresses && Array.isArray(profileContent.lightning_addresses)) {
      profileContent.lightning_addresses.forEach((addr: any) => {
        if (typeof addr === 'string' && addr.trim() !== '' && !allAddresses.includes(addr.trim())) {
          allAddresses.push(addr.trim());
        }
      });
    }

    // Fallback to lud06 only if primary lud16 was not found
    if (!primaryLud16 && profileContent.lud06 && typeof profileContent.lud06 === 'string' && profileContent.lud06.trim() !== '') {
      const lud06Addr = profileContent.lud06.trim();
      if (!allAddresses.includes(lud06Addr)) { // Ensure not to add if it was somehow already in lightning_addresses
          allAddresses.push(lud06Addr);
      }
    }
    
    // console.log(`[LN Resolver Multi] Found addresses for ${pubkeyHex}:`, allAddresses);
    return allAddresses.filter(addr => addr); // Final filter for any empty strings that might have slipped through

  } catch (e) {
    // console.error(`[LN Resolver Multi] Error parsing Kind 0 content for ${pubkeyHex}:`, e);
    return [];
  }
} 