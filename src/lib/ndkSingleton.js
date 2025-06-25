// Lightweight JS fallback so Node diagnostics can run without TS loader.
import NDK from '@nostr-dev-kit/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
import { relays } from '../config/relays.js';

console.log('[ndkSingleton.js] Initializing NDK with relays:', relays);

// Initialize Dexie cache adapter for nutzap state persistence (MEDIUM PRIORITY FIX)
// TEMPORARILY DISABLED - CORRUPTED CACHE CAUSING MENU ISSUES
// const dexieAdapter = new NDKCacheAdapterDexie({ dbName: 'runstr-ndk-cache' });

const ndk = new NDK({ 
  explicitRelayUrls: relays,
  // cacheAdapter: dexieAdapter // TEMPORARILY DISABLED
});

const ndkReadyPromise = (async () => {
  console.log('[ndkSingleton.js] ndkReadyPromise: Attempting ndk.connect()...');
  try {
    await ndk.connect();
    console.log('[ndkSingleton.js] ndk.connect() successful.');
    
    // Pass the NDK instance to the adapter after NDK is initialized
    // This allows the adapter to use the NDK instance if needed (e.g., for deserializing events)
    // TEMPORARILY DISABLED - CORRUPTED CACHE CAUSING MENU ISSUES
    // dexieAdapter.ndk = ndk;
    // console.log('[ndkSingleton.js] Cache adapter configured with NDK instance.');
    
    return true;
  } catch (err) {
    console.error('[ndkSingleton.js] ndk.connect() FAILED:', err);
    return false;
  }
})();

export { ndk, ndkReadyPromise };

export const awaitNDKReady = async (timeoutMs = 10000) => {
  console.log('[ndkSingleton.js] awaitNDKReady called, timeout:', timeoutMs);
  const result = await Promise.race([
    ndkReadyPromise,
    new Promise((res) => setTimeout(() => {
      console.log('[ndkSingleton.js] awaitNDKReady: Timeout reached.');
      res(false);
    }, timeoutMs)),
  ]);
  console.log('[ndkSingleton.js] awaitNDKReady result:', result);
  return result;
}; 