import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';

// Storage for keys
let cachedKeyPair = null;

// Storage for authenticated user's public key from Amber
let amberUserPubkey = null;

/**
 * Set the authenticated user's public key from Amber
 * @param {string} pubkey - The user's public key
 */
export const setAmberUserPubkey = (pubkey) => {
  if (pubkey && typeof pubkey === 'string') {
    amberUserPubkey = pubkey;
    console.log('Set Amber user pubkey:', pubkey);
  }
};

/**
 * Generate a new key pair
 * @returns {Object} Key pair { privateKey, publicKey }
 */
export const generateKeyPair = () => {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  return {
    privateKey: sk,
    publicKey: pk
  };
};

/**
 * Get the current signing key, generating one if needed
 * @returns {Promise<Uint8Array>} Private key
 */
export const getSigningKey = async () => {
  if (cachedKeyPair && cachedKeyPair.privateKey) {
    return cachedKeyPair.privateKey;
  }
  
  const npub = localStorage.getItem('currentNpub');
  return npub ? generateSecretKey() : null;
};

/**
 * Get the current user's public key
 * @returns {Promise<string>} Public key or null if not available
 */
export const getUserPublicKey = async () => {
  try {
    // First priority: Check if we have an Amber-authenticated pubkey
    if (amberUserPubkey) {
      return amberUserPubkey;
    }
    
    console.warn('No Amber-authenticated public key found');
    return null;
  } catch (error) {
    console.error('Error in getUserPublicKey:', error);
    return null;
  }
}; 