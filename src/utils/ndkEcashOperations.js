import { NDKEvent } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

/**
 * Pure NDK Event-Based E-cash Operations
 * Uses NIP-60 events for token management without cashu.ts dependencies
 */

/**
 * Calculate user's ecash balance from NIP-60 token events
 * @param {NDK} ndk - NDK instance
 * @param {string} userPubkey - User's pubkey
 * @returns {Promise<number>} Balance in sats
 */
export const calculateBalance = async (ndk, userPubkey) => {
  try {
    console.log('[NDKEcash] Calculating balance from events...');

    if (!ndk || !userPubkey) {
      console.warn('[NDKEcash] Missing NDK or pubkey for balance calculation');
      return 0;
    }

    // Fetch NIP-60 token events (kind 7376)
    const tokenEvents = await ndk.fetchEvents({
      kinds: [7376], // Cashu token events
      authors: [userPubkey],
      limit: 200
    });

    let totalBalance = 0;
    const processedTokens = new Set();

    console.log(`[NDKEcash] Found ${tokenEvents.size} token events`);

    tokenEvents.forEach(event => {
      try {
        const tokenData = JSON.parse(event.content);
        
        // Avoid double-counting the same token
        const tokenId = event.id;
        if (processedTokens.has(tokenId)) {
          return;
        }
        processedTokens.add(tokenId);

        // Add amount if valid
        if (tokenData.amount && typeof tokenData.amount === 'number') {
          totalBalance += tokenData.amount;
          console.log(`[NDKEcash] Added ${tokenData.amount} sats from event ${tokenId.substring(0, 8)}`);
        }
      } catch (e) {
        console.warn('[NDKEcash] Invalid token event:', e);
      }
    });

    console.log(`[NDKEcash] Total calculated balance: ${totalBalance} sats`);
    return totalBalance;
    
  } catch (error) {
    console.error('[NDKEcash] Balance calculation error:', error);
    return 0;
  }
};

/**
 * Create and publish a NIP-60 token event
 * @param {NDK} ndk - NDK instance
 * @param {string} recipientPubkey - Recipient's pubkey (for sends) or own pubkey (for receives)
 * @param {number} amount - Amount in sats
 * @param {string} mintUrl - Mint URL
 * @param {string} tokenString - Encoded token string
 * @param {string} memo - Optional memo
 * @returns {Promise<NDKEvent>} Published event
 */
export const createTokenEvent = async (ndk, recipientPubkey, amount, mintUrl, tokenString, memo = '') => {
  try {
    console.log(`[NDKEcash] Creating token event for ${amount} sats`);

    if (!ndk.signer) {
      throw new Error('NDK signer not available');
    }

    const tokenEvent = new NDKEvent(ndk);
    tokenEvent.kind = 7376; // NIP-60 Cashu token
    tokenEvent.content = JSON.stringify({
      amount,
      mint: mintUrl,
      token: tokenString,
      memo: memo || '',
      created: Math.floor(Date.now() / 1000)
    });
    
    tokenEvent.tags = [
      ['mint', mintUrl],
      ['amount', amount.toString()],
    ];

    if (recipientPubkey && recipientPubkey !== ndk.activeUser?.pubkey) {
      tokenEvent.tags.push(['p', recipientPubkey]);
    }

    await tokenEvent.publish();
    console.log('[NDKEcash] Token event published successfully');
    return tokenEvent;

  } catch (error) {
    console.error('[NDKEcash] Token event creation error:', error);
    throw error;
  }
};

/**
 * Send ecash token via encrypted DM
 * @param {NDK} ndk - NDK instance
 * @param {string} recipientPubkey - Recipient's pubkey
 * @param {string} tokenString - Encoded token string
 * @param {number} amount - Amount in sats
 * @param {string} memo - Optional memo
 * @returns {Promise<Object>} Result object
 */
export const sendTokenViaDM = async (ndk, recipientPubkey, tokenString, amount, memo = '') => {
  try {
    console.log(`[NDKEcash] Sending ${amount} sats via DM to ${recipientPubkey.substring(0, 8)}...`);

    if (!ndk.signer) {
      throw new Error('NDK signer not available');
    }

    // Validate recipient pubkey format
    let cleanPubkey = recipientPubkey;
    if (recipientPubkey.startsWith('npub')) {
      const decoded = nip19.decode(recipientPubkey);
      cleanPubkey = decoded.data;
    }

    // Create DM content with token and memo
    const dmContent = `${memo ? memo + '\n\n' : ''}Ecash token (${amount} sats): ${tokenString}`;
    
    // Create encrypted DM event (kind 4)
    const dmEvent = new NDKEvent(ndk);
    dmEvent.kind = 4;
    dmEvent.content = dmContent;
    dmEvent.tags = [['p', cleanPubkey]];
    dmEvent.created_at = Math.floor(Date.now() / 1000);

    // Encrypt the content for the recipient
    await dmEvent.encrypt(cleanPubkey);
    
    // Publish the encrypted DM
    await dmEvent.publish();
    
    console.log('[NDKEcash] Token sent via DM successfully');
    
    return {
      success: true,
      amount,
      message: `Successfully sent ${amount} sats via encrypted DM`
    };
    
  } catch (error) {
    console.error('[NDKEcash] Failed to send DM:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to send token via DM: ' + error.message
    };
  }
};

/**
 * Receive and process an ecash token string
 * @param {NDK} ndk - NDK instance  
 * @param {string} userPubkey - User's pubkey
 * @param {string} tokenString - Encoded token string
 * @param {string} mintUrl - Mint URL
 * @returns {Promise<Object>} Result object
 */
export const receiveToken = async (ndk, userPubkey, tokenString, mintUrl) => {
  try {
    console.log('[NDKEcash] Processing received token...');

    if (!tokenString || typeof tokenString !== 'string') {
      throw new Error('Invalid token format');
    }

    // Basic token validation - extract amount if possible
    let amount = 0;
    try {
      // Try to decode token to get amount
      const cleanToken = tokenString.replace(/^cashu/, '');
      const decoded = JSON.parse(atob(cleanToken));
      
      if (decoded.token && Array.isArray(decoded.token)) {
        decoded.token.forEach(tokenGroup => {
          if (tokenGroup.proofs && Array.isArray(tokenGroup.proofs)) {
            tokenGroup.proofs.forEach(proof => {
              if (proof.amount) {
                amount += proof.amount;
              }
            });
          }
        });
      }
    } catch (e) {
      console.warn('[NDKEcash] Could not decode token amount, using default');
      amount = 1; // Default amount if we can't decode
    }

    // Create token event to record receipt
    await createTokenEvent(ndk, userPubkey, amount, mintUrl, tokenString, 'Received token');

    console.log(`[NDKEcash] Successfully received ${amount} sats`);
    return {
      success: true,
      amount,
      message: `Successfully received ${amount} sats`
    };

  } catch (error) {
    console.error('[NDKEcash] Receive token error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to receive token: ' + error.message
    };
  }
};

/**
 * Find user's wallet configuration from NIP-60 events
 * @param {NDK} ndk - NDK instance
 * @param {string} userPubkey - User's pubkey
 * @returns {Promise<Object>} Wallet configuration
 */
export const findWalletConfig = async (ndk, userPubkey) => {
  try {
    console.log('[NDKEcash] Finding wallet configuration...');

    // Fetch wallet metadata events (kind 17375)
    const walletEvents = await ndk.fetchEvents({
      kinds: [17375], // Wallet metadata
      authors: [userPubkey],
      limit: 5
    });

    // Fetch mint list events (kind 10019)
    const mintEvents = await ndk.fetchEvents({
      kinds: [10019], // Mint lists  
      authors: [userPubkey],
      limit: 5
    });

    // Get most recent events
    const latestWallet = Array.from(walletEvents)
      .sort((a, b) => b.created_at - a.created_at)[0];
    const latestMints = Array.from(mintEvents)
      .sort((a, b) => b.created_at - a.created_at)[0];

    let mints = [];
    if (latestMints) {
      try {
        const mintData = JSON.parse(latestMints.content);
        mints = mintData.mints || [];
      } catch (e) {
        console.warn('[NDKEcash] Could not parse mint list');
      }
    }

    return {
      hasWallet: walletEvents.size > 0,
      walletEvent: latestWallet,
      mintEvent: latestMints,
      mints,
      isConfigured: walletEvents.size > 0 && mintEvents.size > 0
    };

  } catch (error) {
    console.error('[NDKEcash] Wallet config lookup error:', error);
    return {
      hasWallet: false,
      walletEvent: null,
      mintEvent: null,
      mints: [],
      isConfigured: false
    };
  }
};

/**
 * Create and publish wallet configuration events
 * @param {NDK} ndk - NDK instance
 * @param {string} mintUrl - Primary mint URL
 * @param {Array} additionalMints - Additional mint URLs
 * @returns {Promise<Object>} Published events
 */
export const publishWalletConfig = async (ndk, mintUrl, additionalMints = []) => {
  try {
    console.log('[NDKEcash] Publishing wallet configuration...');

    if (!ndk.signer) {
      throw new Error('NDK signer not available');
    }

    const allMints = [mintUrl, ...additionalMints];

    // Create wallet metadata event (kind 17375)
    const walletEvent = new NDKEvent(ndk);
    walletEvent.kind = 17375;
    walletEvent.content = JSON.stringify({
      name: "RUNSTR Ecash Wallet",
      description: "NIP-60 Ecash wallet for RUNSTR rewards",
      created: Math.floor(Date.now() / 1000)
    });
    walletEvent.tags = [['d', 'default']];

    // Create mint list event (kind 10019)  
    const mintEvent = new NDKEvent(ndk);
    mintEvent.kind = 10019;
    mintEvent.content = JSON.stringify({
      mints: allMints.map(url => ({ url, active: true }))
    });
    mintEvent.tags = [['d', 'default']];

    // Publish both events
    await Promise.all([
      walletEvent.publish(),
      mintEvent.publish()
    ]);

    console.log('[NDKEcash] Wallet configuration published successfully');
    return { walletEvent, mintEvent };

  } catch (error) {
    console.error('[NDKEcash] Wallet config publish error:', error);
    throw error;
  }
};

/**
 * Validate token string format
 * @param {string} tokenString - Token to validate
 * @returns {boolean} True if valid format
 */
export const isValidTokenFormat = (tokenString) => {
  if (!tokenString || typeof tokenString !== 'string') {
    return false;
  }

  try {
    const cleanToken = tokenString.replace(/^cashu/, '');
    const decoded = JSON.parse(atob(cleanToken));
    return decoded.token && Array.isArray(decoded.token);
  } catch (error) {
    return false;
  }
}; 