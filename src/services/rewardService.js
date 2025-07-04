import { NWCWallet } from './nwcWallet'; // Assuming path, adjust if necessary
import { getProfile } from '../utils/nostr'; // Assuming a utility to fetch profiles
import { finalizeEvent, getPublicKey } from 'nostr-tools';
import { bech32 } from 'bech32';

// IMPORTANT: Replace with your actual Runstr Reward NWC URI
const RUNSTR_REWARD_NWC_URI = "nostr+walletconnect://bc8032a1af649b90f45a8395c5054d8b45dacf6f3e99b99d6c11206e887f10e2?relay=wss://relay.getalby.com/v1&secret=8793aaf0eab13050cd52542d8b711b240511d80a84324a8a948ab7a81d3fba26&lud16=hustle@getalby.com";

const runstrRewardWallet = new NWCWallet();
let isConnecting = false;
let connectionPromise = null;

async function ensureRewardWalletConnected() {
  // If the provider object exists we assume a previous `connect` + `enable` succeeded.
  // Some SDK versions don't expose `isEnabled`, so we avoid calling it directly.
  if (runstrRewardWallet.provider) {
    return true;
  }
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  isConnecting = true;
  connectionPromise = (async () => {
    try {
      console.log('[RewardService] Connecting to Runstr reward wallet...');
      await runstrRewardWallet.connect(RUNSTR_REWARD_NWC_URI);
      console.log('[RewardService] Runstr reward wallet connected.');
      return true;
    } catch (error) {
      console.error('[RewardService] Failed to connect to Runstr reward wallet:', error);
      // Reset for next attempt
      isConnecting = false;
      connectionPromise = null;
      runstrRewardWallet.provider = null; // Ensure provider is cleared on failure
      throw new Error('Failed to connect to Runstr reward wallet. Check URI and relay.');
    } finally {
      isConnecting = false;
      // Keep connectionPromise resolved/rejected status for subsequent calls in this attempt chain.
    }
  })();
  return connectionPromise;
}

async function getLud16FromProfile(pubkey) {
  try {
    const profile = await getProfile(pubkey); // This function needs to exist
    if (profile && profile.lud16) {
      return profile.lud16;
    }
    // Fallback to lud06 if lud16 not present
    if (profile && profile.lud06) {
        return profile.lud06;
    }
    console.warn(`[RewardService] No lud16 or lud06 found for pubkey: ${pubkey}`);
    return null;
  } catch (error) {
    console.error(`[RewardService] Error fetching profile for ${pubkey}:`, error);
    return null;
  }
}

// --------------------
// LNURL / NIP-57 Helpers
// --------------------

/**
 * Decode a bech32-encoded LNURL string to its raw https URL.
 * @param {string} lnurlBech32
 * @returns {string|null}
 */
function decodeBech32Url(lnurlBech32) {
  try {
    const { words } = bech32.decode(lnurlBech32.toLowerCase(), 1500);
    const bytes = bech32.fromWords(words);
    return new TextDecoder().decode(Uint8Array.from(bytes));
  } catch (err) {
    console.warn('[RewardService] Failed to decode bech32 LNURL:', err);
    return null;
  }
}

/**
 * Fetch LNURL-Pay endpoint details given a lud16/lud06 value.
 * Returns the JSON object from the endpoint (contains callback, minSendable, etc.).
 */
async function fetchLnurlDetails(lud) {
  if (!lud) return null;

  let lnurlPayUrl;
  if (lud.includes('@')) {
    // lightning address (name@domain)
    const [name, domain] = lud.split('@');
    lnurlPayUrl = `https://${domain}/.well-known/lnurlp/${name}`;
  } else if (lud.toLowerCase().startsWith('lnurl')) {
    // bech32 encoded lnurl
    lnurlPayUrl = decodeBech32Url(lud);
  }

  if (!lnurlPayUrl) return null;

  try {
    const resp = await fetch(lnurlPayUrl, { headers: { Accept: 'application/json' }, mode: 'cors' });
    if (!resp.ok) throw new Error(`Status ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.error('[RewardService] Error fetching LNURL details:', err);
    return null;
  }
}

/**
 * Helper that base64-encodes a JSON object using browser-safe method.
 */
function base64Json(obj) {
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json)));
}

/**
 * Sends a NIP-57 lightning zap from the configured Runstr reward NWC wallet.
 *
 * @param {string} recipientPubkey The user receiving the zap.
 * @param {number} amountSats Amount in satoshis.
 * @param {string} message Zap request comment.
 * @param {string} zapType Custom tag for tracking e.g. streak_reward, nip101_reward.
 * @param {string} fallbackLightningAddress Fallback LN address if zap fails
 * @returns {Promise<PayoutResult>}
 */
export async function sendRewardZap(recipientPubkey, amountSats, message, zapType = 'general_reward', fallbackLightningAddress = null) {
  // Show an optimistic notification immediately so users get feedback.
  try {
    if (typeof window !== 'undefined') {
      if (window.Android && window.Android.showToast) {
        window.Android.showToast(`Sending ${amountSats} sats reward…`);
      }
    }
  } catch (_) {}

  try {
    await ensureRewardWalletConnected();
  } catch (error) {
    return { success: false, message: 'Reward wallet connection failed.', error: error.message };
  }

  let lud16 = fallbackLightningAddress; // Prioritize explicitly passed fallback from function arguments

  // If no argument fallback, try the manually set global fallback from localStorage
  if (!lud16) {
    const globallySetManualAddress = localStorage.getItem('manualLightningAddress');
    if (globallySetManualAddress && globallySetManualAddress.includes('@')) {
      lud16 = globallySetManualAddress;
      console.log(`[RewardService] Using globally set manual Lightning Address as fallback: ${lud16} for recipient ${recipientPubkey}`);
    }
  }

  // If still no address, try fetching from the recipient's profile
  if (!lud16) {
    console.log(`[RewardService] No manual or argument fallback LN Address for ${recipientPubkey}, attempting profile lookup.`);
    lud16 = await getLud16FromProfile(recipientPubkey);
  }

  if (!lud16) {
    return { success: false, message: 'Recipient does not have a Lightning Address (lud16/lud06) in their profile.', error: 'No lud16/lud06' };
  }

  try {
    const lnurlDetails = await fetchLnurlDetails(lud16);
    if (!lnurlDetails || !lnurlDetails.callback) {
      console.error('[RewardService] Invalid LNURL details for', lud16, lnurlDetails);
      return { success: false, message: 'Invalid LNURL details.', error: 'LNURL invalid' };
    }

    if (lnurlDetails.minSendable && lnurlDetails.minSendable > amountSats * 1000) {
      return { success: false, message: `Amount too low. Minimum is ${lnurlDetails.minSendable / 1000} sats.`, error: 'Amount too low' };
    }

    if (lnurlDetails.allowsNostr === false) {
      console.warn('[RewardService] LNURL provider does not allow nostr zaps, will fallback');
      throw new Error('Provider does not allow nostr');
    }

    // --- Build and sign zap-request (NIP-57) ---
    const relaysTag = ['relays', 'wss://relay.damus.io', 'wss://nos.lol'];

    let zapRequestEvent = {
      kind: 9734,
      pubkey: runstrRewardWallet.pubKey || (() => {
        if (runstrRewardWallet.secretKey) {
          const skHex = Array.from(runstrRewardWallet.secretKey)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          return getPublicKey(skHex);
        }
        return undefined;
      })(),
      created_at: Math.floor(Date.now() / 1000),
      content: message,
      tags: [
        ['p', recipientPubkey],
        ['amount', (amountSats * 1000).toString()],
        relaysTag
      ]
    };

    try {
      if (runstrRewardWallet.provider && typeof runstrRewardWallet.provider.signEvent === 'function') {
        zapRequestEvent = await runstrRewardWallet.provider.signEvent(zapRequestEvent);
      } else if (runstrRewardWallet.secretKey) {
        // nostr-tools finaliseEvent expects a hex encoded private key string
        const skHex = Array.from(runstrRewardWallet.secretKey)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        zapRequestEvent = finalizeEvent(zapRequestEvent, skHex);
      }
    } catch (signErr) {
      console.warn('[RewardService] Could not sign zap request, proceeding unsigned', signErr);
    }

    const zapRequestB64 = base64Json(zapRequestEvent);

    const callbackUrl = new URL(lnurlDetails.callback);
    callbackUrl.searchParams.set('amount', (amountSats * 1000).toString());
    callbackUrl.searchParams.set('nostr', zapRequestB64);
    if (message) callbackUrl.searchParams.set('comment', message.substring(0, 200));

    const invResp = await fetch(callbackUrl.toString(), { headers: { Accept: 'application/json' } });
    if (!invResp.ok) throw new Error(`Invoice callback returned ${invResp.status}`);
    const invJson = await invResp.json();

    if (!invJson.pr) {
      throw new Error('No invoice in response');
    }

    console.log('[RewardService] Obtained invoice:', invJson.pr.substring(0, 60), '…');

    // Pay invoice
    const paymentResponse = await runstrRewardWallet.makePayment(invJson.pr);

    if (paymentResponse && (paymentResponse.preimage || paymentResponse.payment_hash || (paymentResponse.data && paymentResponse.data.preimage))) {
      console.log(`[RewardService] Successfully sent ${amountSats} sats for ${zapType} to ${recipientPubkey}`);
      return { success: true, message: `Successfully sent ${amountSats} sats!`, paymentResponse, txid: (paymentResponse.payment_hash || paymentResponse.preimage || (paymentResponse.data && paymentResponse.data.payment_hash)) };
    }

    throw new Error('Payment failed or no preimage');
  } catch (error) {
    console.error(`[RewardService] Error during zap process for ${zapType} to ${recipientPubkey}:`, error);
    let errorMessage = error.message || 'Unknown error during zap.';
    if (error.response && error.response.data && error.response.data.reason) {
      errorMessage = error.response.data.reason;
    }
    // At this point zap failed – try plain LN address fallback if provided
    if (fallbackLightningAddress && fallbackLightningAddress.includes('@')) {
      try {
        const { payLightningAddress } = await import('../services/nwcService.js');
        const payRes = await payLightningAddress(fallbackLightningAddress, amountSats, message);
        if (payRes.success) {
          console.log(`[RewardService] Paid ${amountSats} sats via LN address fallback to ${fallbackLightningAddress}`);
          return { success: true, message: `Paid via LN address fallback`, paymentResponse: payRes.result };
        }
        console.warn('[RewardService] LN fallback failed', payRes.error);
      } catch (lnErr) {
        console.error('[RewardService] LN fallback threw', lnErr);
      }
    }
    return { success: false, message: `Failed to send zap: ${errorMessage}`, error: errorMessage };
  }
}

// Placeholder for NIP101e/h post reward
// You'll need to call this from where you confirm a NIP101e/h post.
export async function rewardNip101Post(recipientPubkey, kind, eventId) {
  // IMPORTANT: Define your KIND numbers and any specific tag checks for NIP101e/h
  const NIP101_REWARD_AMOUNT_SATS = 5;
  let rewardType = '';
  let message = '';

  if (kind === globalThis.NIP101e_KIND_NUMBER) { // Replace with actual kind number
    rewardType = 'nip101e_post';
    message = `Thanks for your NIP101e post! +${NIP101_REWARD_AMOUNT_SATS} sats from Runstr.`;
  } else if (kind === globalThis.NIP101h_KIND_NUMBER) { // Replace with actual kind number
    rewardType = 'nip101h_post';
    message = `Thanks for not saving your data with RUNSTR`; // Updated message
  } else {
    console.warn(`[RewardService] Unknown kind for NIP101 reward: ${kind}`);
    return { success: false, message: 'Unknown NIP101 kind.'};
  }
  
  // Potentially add more checks here based on eventId or specific tags if needed

  return sendRewardZap(recipientPubkey, NIP101_REWARD_AMOUNT_SATS, message, rewardType);
}

// Placeholder for Streak completion reward
// You'll need to call this from where you detect a streak completion.
export async function rewardStreakCompletion(recipientPubkey, streakDays, lightningAddress = null) {
  const STREAK_REWARD_AMOUNT_SATS = 100; // linear model (100 per day)
  const message = `Congrats on your ${streakDays}-day streak! +${STREAK_REWARD_AMOUNT_SATS} sats from Runstr! 🔥`;
  const rewardType = 'streak_completion';
  // Pass the explicit lightningAddress from arguments if available, sendRewardZap will handle internal fallbacks
  return sendRewardZap(recipientPubkey, STREAK_REWARD_AMOUNT_SATS, message, rewardType, lightningAddress);
}

/**
 * Generic helper for 5-/10-sat micro-rewards when a user completes an in-app action (workout post, profile update).
 * @param {string} recipientPubkey - Runner's hex pubkey.
 * @param {('workout_record'|'profile_update')} activityType - What they just did.
 * @param {boolean} usedPrivateRelay - true if the publish destination was set to `private`.
 * @param {string} lightningAddress - Optional LN address for fallback
 */
export async function rewardUserActivity(recipientPubkey, activityType, usedPrivateRelay = false, lightningAddress = null) {
  const base = 5;
  const finalAmount = usedPrivateRelay ? base + 5 : base; // 10 sats if private relay, else 5
  const messageAction = activityType === 'profile_update' ? 'updating your profile' : 'posting your workout';
  const message = `Thanks for ${messageAction}! +${finalAmount} sats from Runstr${usedPrivateRelay ? ' (private relay bonus!)' : ''}.`;
  const zapType = activityType === 'profile_update' ? 'profile_update_reward' : 'workout_record_reward';

  try {
    // Pass the explicit lightningAddress from arguments if available, sendRewardZap will handle internal fallbacks
    const result = await sendRewardZap(recipientPubkey, finalAmount, message, zapType, lightningAddress);
    return result;
  } catch (error) {
    console.error(`[RewardService] Error during rewardUserActivity for ${activityType} to ${recipientPubkey}:`, error);
    let errorMessage = error.message || 'Unknown error during rewardUserActivity.';
    if (error.response && error.response.data && error.response.data.reason) {
      errorMessage = error.response.data.reason;
    }
    return { success: false, message: `Failed to send reward: ${errorMessage}`, error: errorMessage };
  }
} 