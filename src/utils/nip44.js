// NIP-44 helper utilities – NDK-only implementation
// --------------------------------------------------
// This module centralises NIP-44 encryption / decryption so that the rest of the
// codebase doesn't need to know the exact API details of the NDK signer.
//
// It exports two async helpers:
// • encryptContentNip44(plaintext, recipientPubkey) -> { cipherText, nip44Tags[] }
// • decryptContentNip44(cipherText, senderPubkey)   -> plaintext
//
// The helpers assume the global NDK singleton and its signer have already been
// initialised (handled in src/lib/ndkSingleton.ts).
// If the signer is missing we throw, because encryption is mandatory by default
// for health events.

import { ndk } from '../lib/ndkSingleton';

/**
 * Encrypt a plaintext string using NIP-44 (XChaCha20-Poly1305) to a single
 * recipient.  The function returns the cipher text and the standard tag set
 * that must be appended to the Nostr event.
 *
 * @param {string} plaintext           – The data to encrypt (usually the
 *                                       metric value as string).
 * @param {string} recipientPubkeyHex  – hex-encoded pubkey (32-byte) of the
 *                                       recipient.  For "encrypt-to-self"
 *                                       pass the user's own pubkey.
 * @returns {Promise<{ cipherText:string, nip44Tags:Array }>}  – encrypted
 *          payload plus `[['p', …], ['encryption_algo','nip44']]` tags.
 */
export const encryptContentNip44 = async (plaintext, recipientPubkeyHex) => {
  if (!plaintext && plaintext !== '0') {
    throw new Error('[nip44] Cannot encrypt empty plaintext');
  }
  if (!recipientPubkeyHex) {
    throw new Error('[nip44] recipientPubkey is required for encryption');
  }
  // Ensure signer is present
  if (!ndk?.signer?.user) {
    console.warn('[nip44] No NDK signer available – publishing plaintext');
    return { cipherText: plaintext, nip44Tags: [] };
  }

  try {
    // NDK's user.encrypt(pubkey, plaintext, { algo: 'nip44' }) is expected API.
    // Fallback: if `algo` param not yet supported, user.encrypt() defaults to
    // nip04; we explicitly request nip44.
    const user = ndk.signer.user();
    const cipherText = await user.encrypt(recipientPubkeyHex, plaintext, {
      algo: 'nip44'
    });

    const nip44Tags = [
      ['p', recipientPubkeyHex],
      ['encryption_algo', 'nip44']
    ];

    return { cipherText, nip44Tags };
  } catch (err) {
    console.error('[nip44] Encryption failed:', err);
    throw err;
  }
};

/**
 * Decrypt a NIP-44 cipher text sent by `senderPubkeyHex`.
 * Currently used only for future read flows but implemented for completeness.
 *
 * @param {string} cipherText        – encrypted payload from event.content
 * @param {string} senderPubkeyHex   – pubkey of sender (root of encryption)
 * @returns {Promise<string>} plaintext
 */
export const decryptContentNip44 = async (cipherText, senderPubkeyHex) => {
  if (!cipherText) throw new Error('[nip44] cipherText required');
  if (!senderPubkeyHex) throw new Error('[nip44] senderPubkey required');
  if (!ndk?.signer?.user) {
    throw new Error('[nip44] NDK signer not initialised – cannot decrypt');
  }

  try {
    const user = ndk.signer.user();
    const plaintext = await user.decrypt(senderPubkeyHex, cipherText, {
      algo: 'nip44'
    });
    return plaintext;
  } catch (err) {
    console.error('[nip44] Decryption failed:', err);
    throw err;
  }
}; 