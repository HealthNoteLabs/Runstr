// Lightweight JS fallback so Node diagnostics can run without TS loader.
import NDK from '@nostr-dev-kit/ndk';
import { relays } from '../config/relays.js';

console.log('[ndkSingleton.js] Initializing NDK with relays:', relays);

// Enhanced logging for relay status
const logRelayStatus = (ndk) => {
  const stats = ndk.pool?.stats();
  console.log('[ndkSingleton.js] Relay pool stats:', {
    total: stats?.total || 0,
    connected: stats?.connected || 0,
    connecting: stats?.connecting || 0,
    disconnected: stats?.disconnected || 0,
    relayDetails: ndk.pool?.relays ? Object.fromEntries(
      Array.from(ndk.pool.relays.entries()).map(([url, relay]) => [
        url, 
        { 
          status: relay.status,
          connectionStats: relay.connectionStats 
        }
      ])
    ) : {}
  });
};

const ndk = new NDK({ 
  explicitRelayUrls: relays,
  // Add connection timeout and retry settings
  outboxRelayUrls: relays, // Use same relays for outbox
  enableOutboxModel: false, // Disable for simpler debugging
});

// Add relay event listeners for detailed diagnostics
ndk.pool?.on('relay:connect', (relay) => {
  console.log('[ndkSingleton.js] ✅ Relay connected:', relay.url);
  logRelayStatus(ndk);
});

ndk.pool?.on('relay:disconnect', (relay) => {
  console.log('[ndkSingleton.js] ❌ Relay disconnected:', relay.url);
  logRelayStatus(ndk);
});

ndk.pool?.on('relay:error', (relay, error) => {
  console.error('[ndkSingleton.js] 🚨 Relay error:', relay.url, error);
});

const ndkReadyPromise = (async () => {
  console.log('[ndkSingleton.js] ndkReadyPromise: Starting connection process...');
  console.log('[ndkSingleton.js] Configured relays:', relays);
  
  try {
    console.log('[ndkSingleton.js] Attempting ndk.connect()...');
    
    // Add timeout to connection attempt
    const connectionPromise = ndk.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000)
    );
    
    await Promise.race([connectionPromise, timeoutPromise]);
    
    console.log('[ndkSingleton.js] ndk.connect() completed.');
    
    // Wait a bit for relays to settle, then check status
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const finalStats = ndk.pool?.stats();
    console.log('[ndkSingleton.js] Final connection stats:', finalStats);
    logRelayStatus(ndk);
    
    const connectedCount = finalStats?.connected || 0;
    if (connectedCount > 0) {
      console.log(`[ndkSingleton.js] ✅ Successfully connected to ${connectedCount} relay(s)`);
      return true;
    } else {
      console.error('[ndkSingleton.js] ❌ No relays connected after connect() completed');
      return false;
    }
    
  } catch (err) {
    console.error('[ndkSingleton.js] 🚨 ndk.connect() FAILED with error:', err);
    console.error('[ndkSingleton.js] Error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    
    // Still log relay status even on failure
    logRelayStatus(ndk);
    
    return false;
  }
})();

export { ndk, ndkReadyPromise };

export const awaitNDKReady = async (timeoutMs = 20000) => {
  console.log('[ndkSingleton.js] awaitNDKReady called, timeout:', timeoutMs);
  
  const result = await Promise.race([
    ndkReadyPromise,
    new Promise((res) => setTimeout(() => {
      console.log('[ndkSingleton.js] awaitNDKReady: Timeout reached.');
      logRelayStatus(ndk); // Log status on timeout too
      res(false);
    }, timeoutMs)),
  ]);
  
  console.log('[ndkSingleton.js] awaitNDKReady result:', result);
  
  // Additional diagnostics on failure
  if (!result) {
    console.log('[ndkSingleton.js] Connection failed - attempting relay diagnostics...');
    
    // Test individual relay connectivity
    for (const relayUrl of relays) {
      try {
        console.log(`[ndkSingleton.js] Testing relay: ${relayUrl}`);
        const ws = new WebSocket(relayUrl);
        
        ws.onopen = () => {
          console.log(`[ndkSingleton.js] ✅ WebSocket test successful for: ${relayUrl}`);
          ws.close();
        };
        
        ws.onerror = (error) => {
          console.error(`[ndkSingleton.js] ❌ WebSocket test failed for: ${relayUrl}`, error);
        };
        
        ws.onclose = (event) => {
          if (event.code !== 1000) {
            console.warn(`[ndkSingleton.js] ⚠️ WebSocket closed unexpectedly for: ${relayUrl}`, event);
          }
        };
        
        // Close connection after 3 seconds if still open
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        }, 3000);
        
      } catch (testError) {
        console.error(`[ndkSingleton.js] ❌ Failed to test relay ${relayUrl}:`, testError);
      }
    }
  }
  
  return result;
}; 