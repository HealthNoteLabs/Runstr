import { ndk } from '../lib/ndkSingleton.js';
// Import NDKRelayStatus normally - will rely on runtime check or ignore if it fails
// import { NDKRelayStatus } from '@nostr-dev-kit/ndk'; // Removed unused import

/**
 * ENSURE RELAYS - SIMPLIFIED VERSION (Debug)
 * 
 * This version currently does *nothing* except log.
 * It relies entirely on NDK connecting to the relays provided in its constructor
 * (`explicitRelayUrls` in NostrContext.jsx).
 * This avoids calling the problematic ndk.pool.addRelay() or ndk.addExplicitRelay().
 *
 * @param {string[]} relayUrls - An array of relay URLs (currently ignored).
 */
export const ensureRelays = async (relayUrls) => {
  if (!ndk) {
    console.error("[ensureRelays - Simplified] NDK instance not available.");
    return;
  }
  if (!ndk.pool) {
    console.error("[ensureRelays - Simplified] NDK pool is not available.");
    return;
  }

  const urlsToLog = Array.isArray(relayUrls) ? relayUrls : (relayUrls ? [relayUrls] : []);
  const uniqueUrls = [...new Set(urlsToLog.filter(url => typeof url === 'string' && url.trim() !== ''))];

  // Only log the intention, do not interact with the pool here.
  console.log(`[ensureRelays - Simplified] Intended relays for operation:`, uniqueUrls);
  console.log(`[ensureRelays - Simplified] Relying on NDK auto-connect based on constructor explicitRelayUrls.`);
  
  // No pool interaction, just return.
  // We add a minimal delay just in case async nature is expected elsewhere.
  await new Promise(resolve => setTimeout(resolve, 50)); 
};

/**
 * Waits for a minimum number of relays to be connected to the NDK pool.
 * @param {number} minRelays - The minimum number of connected relays to wait for.
 * @param {number} timeoutMs - The maximum time to wait in milliseconds.
 * @returns {Promise<boolean>} A promise that resolves to true if the condition is met, false on timeout.
 */
export const waitForConnectedRelays = async (minRelays = 1, timeoutMs = 8000) => {
  if (!ndk || !ndk.pool) {
    console.error('waitForConnectedRelays: NDK instance or NDK pool is not available.');
    return false;
  }

  // Use NDK's built-in stats which should be reliable
  if (ndk.pool.stats().connected >= minRelays) {
    console.log(`waitForConnectedRelays: Already connected to ${ndk.pool.stats().connected} >= ${minRelays} relay(s).`);
    return true;
  }

  console.log(`waitForConnectedRelays: Waiting for at least ${minRelays} relay(s) to connect (current: ${ndk.pool.stats().connected}, max ${timeoutMs}ms)...`);

  try {
    // NDK's awaitConnection throws an error on timeout if minRelays is not met.
    // It resolves (void) if the condition is met within the timeout.
    await ndk.awaitConnection(minRelays, timeoutMs);
    const finalCount = ndk.pool.stats().connected; // Re-check count after await
    console.log(`waitForConnectedRelays: Successfully connected to ${finalCount} relay(s) (met condition for ${minRelays}).`);
    return true;
  } catch (error) {
    // This catch block will be entered if awaitConnection times out because minRelays were not connected.
    const finalCount = ndk.pool.stats().connected; // Check count on timeout
    console.warn(`waitForConnectedRelays: Timed out or failed waiting for ${minRelays} relay(s) within ${timeoutMs}ms. Connected: ${finalCount}. Error: ${error.message}`);
    return false;
  }
}; 