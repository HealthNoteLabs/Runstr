import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Prioritized relay list - ordered by reliability and speed
export const PRIORITIZED_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.bg',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://purplepag.es', 
  'wss://nostr.wine',
  'wss://nostr.mom'
];

// Backup relays - used if prioritized relays fail
export const BACKUP_RELAYS = [
  'wss://relay.current.fyi',
  'wss://brb.io',
  'wss://nostr.fmt.wiz.biz',
  'wss://relay.nostr.info'
];

// Export all relays for backwards compatibility
export const RELAYS = [...PRIORITIZED_RELAYS, ...BACKUP_RELAYS];

// Connection state tracking
let connectionState = {
  initialized: false,
  lastConnectAttempt: 0,
  connectedRelays: 0,
  connectionPromise: null
};

// Export loggedInUser as a let variable
export let loggedInUser = null;

// Initialize NDK instance with optimized settings
export const ndk = isBrowser
  ? new NDK({
      explicitRelayUrls: PRIORITIZED_RELAYS.slice(0, 3), // Start with just 3 fastest relays
      enableOutboxModel: true,
      autoConnectRelays: false, // We'll handle connection manually for better control
      autoFetchUserRelays: true, // Get user's preferred relays when available
      connectionTimeout: 2500 // 2.5 seconds timeout for faster failures
    })
  : null;

// Connect to additional relays as needed
const connectToAdditionalRelays = async () => {
  if (!ndk) return false;
  
  // If we already have enough relays connected, don't add more
  if (ndk.pool?.relays?.size >= 3) return true;
  
  console.log(`Adding additional relays to improve connectivity...`);
  
  // Add remaining prioritized relays
  const additionalRelays = [
    ...PRIORITIZED_RELAYS.slice(3),
    ...(ndk.pool?.relays?.size < 2 ? BACKUP_RELAYS : []) // Only use backup relays if we're really struggling
  ];
  
  // Add relays to the pool
  for (const relay of additionalRelays) {
    if (!ndk.pool.getRelay(relay)) {
      ndk.pool.addRelay(relay);
    }
  }
  
  // Wait a bit for connections to establish
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return ndk.pool?.relays?.size > 0;
};

// Initialize NDK connection with improved strategy
export const initializeNostr = async (forceReconnect = false) => {
  if (!ndk) return false;

  // Use cached connection if it's recent (within last 2 minutes) and not forced to reconnect
  const now = Date.now();
  if (
    !forceReconnect &&
    connectionState.initialized &&
    connectionState.connectedRelays > 0 &&
    now - connectionState.lastConnectAttempt < 2 * 60 * 1000
  ) {
    console.log(`Using cached connection to ${connectionState.connectedRelays} relays`);
    return true;
  }

  // If there's already a connection attempt in progress, wait for it
  if (connectionState.connectionPromise) {
    console.log('Connection already in progress, waiting...');
    return connectionState.connectionPromise;
  }

  console.log('Initializing NDK connection...');
  connectionState.lastConnectAttempt = now;

  // Create a promise for the connection attempt that can be shared
  connectionState.connectionPromise = (async () => {
    let retryCount = 0;
    const maxRetries = 2; // Reduced retry count for faster loading

    while (retryCount < maxRetries) {
      try {
        console.log(`Connecting to relays (attempt ${retryCount + 1}/${maxRetries})...`);
        
        // Use a promise race to add timeout
        await Promise.race([
          ndk.connect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 5000)
          )
        ]);

        // Quick check if any relays connected
        if (ndk.pool?.relays?.size > 0) {
          connectionState.initialized = true;
          connectionState.connectedRelays = ndk.pool.relays.size;
          console.log(`Successfully connected to ${ndk.pool.relays.size} relays`);
          
          // Add more relays in the background if needed for redundancy
          if (ndk.pool.relays.size < 3) {
            connectToAdditionalRelays().catch(console.error);
          }
          
          return true;
        }

        // If no relays connected, try connecting to additional relays
        const addedMore = await connectToAdditionalRelays();
        if (addedMore) {
          connectionState.initialized = true;
          connectionState.connectedRelays = ndk.pool.relays.size;
          console.log(`Connected to ${ndk.pool.relays.size} relays after adding additional relays`);
          return true;
        }

        retryCount++;
        if (retryCount < maxRetries) {
          const backoffTime = 1000 * Math.pow(1.5, retryCount); // Shorter backoff
          console.log(`No relays connected. Waiting ${backoffTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      } catch (err) {
        console.error('Error during connection attempt:', err);
        retryCount++;
        if (retryCount < maxRetries) {
          const backoffTime = 1000 * Math.pow(1.5, retryCount);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        }
      }
    }

    console.error('Failed to connect after multiple attempts');
    return false;
  })();

  // Once connection attempt resolves, clear the promise
  try {
    const result = await connectionState.connectionPromise;
    connectionState.connectionPromise = null;
    return result;
  } catch (err) {
    connectionState.connectionPromise = null;
    console.error('Connection attempt failed:', err);
    return false;
  }
};

// Initialize connection when the module loads - but don't wait for it
if (ndk) {
  initializeNostr().catch((err) => {
    console.error('Failed to initialize NDK:', err);
  });
}

export const publishToNostr = async (event) => {
  if (!isBrowser) {
    console.error('Not in browser environment');
    return null;
  }

  if (!event) {
    console.error('No event provided');
    return null;
  }

  if (!ndk) {
    console.error('NDK not initialized');
    return null;
  }

  try {
    if (!window.nostr) {
      console.error(
        'Nostr provider not found. Please ensure you are logged in.'
      );
      throw new Error('Nostr provider not found');
    }

    // Check current connection state
    if (!ndk.pool?.relays?.size) {
      console.log('No active connections found, attempting to reconnect...');
      const isConnected = await initializeNostr();
      if (!isConnected) {
        throw new Error(
          'Could not establish relay connections. Please check your internet connection and try again.'
        );
      }
    } else {
      console.log(
        `Using existing connections to ${ndk.pool.relays.size} relays`
      );
    }

    console.log('Publishing event:', event);
    const signedEvent = await window.nostr.signEvent(event);
    console.log('Event signed:', signedEvent);

    // Create NDK event
    const ndkEvent = new NDKEvent(ndk, signedEvent);

    // Publish with timeout
    const published = await Promise.race([
      ndkEvent.publish(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Publication timeout')), 10000) // Reduced timeout
      )
    ]);

    console.log('Publication successful:', published);
    return published;
  } catch (error) {
    console.error('Error publishing to Nostr:', error);
    throw error;
  }
};
