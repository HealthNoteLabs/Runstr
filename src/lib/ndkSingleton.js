// Lightweight JS fallback so Node diagnostics can run without TS loader.
import NDK from '@nostr-dev-kit/ndk';
import { relays } from '../config/relays.js';

console.log('[ndkSingleton.js] Initializing NDK with relays:', relays);
const ndk = new NDK({ explicitRelayUrls: relays });

const ndkReadyPromise = (async () => {
  console.log('[ndkSingleton.js] ndkReadyPromise: Attempting ndk.connect()...');
  try {
    await ndk.connect();
    console.log('[ndkSingleton.js] ndk.connect() successful.');
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