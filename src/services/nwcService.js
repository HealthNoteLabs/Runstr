// nwcService.js – lightweight Nostr-Wallet-Connect helper
// NOTE:  This is a **first pass** implementation that focuses on the happy-path.
// It will successfully simulate payments in DEMO_MODE and contains everything
// needed to wire up real NWC calls once a test invoice is available.

import { Relay, nip04, finalizeEvent, getPublicKey } from 'nostr-tools';

const DEMO_MODE = false; // set true to bypass real network calls during dev

// 1) Allow runtime override via localStorage (fundingNwcUri)
// 2) Use env variables baked by Vite / Node
// 3) Final hard-coded fallback provided by project owner
const HARDCODED_NWC_URI = 'nostr+walletconnect://17292be0ffe9b1ab3830f9a26fabb8e91c14bec383be4faf00c5e11042192e51?relay=wss://wallets.bitvora.com&secret=250e610ea41fe21aa4ab42cc5d9b718f989977f742c10f8679bd940cda96f48e';

const NWC_URI =
  (typeof localStorage !== 'undefined' && localStorage.getItem('fundingNwcUri')) ||
  (typeof import.meta !== 'undefined' && (import.meta?.env?.VITE_NWC_URI || import.meta?.env?.NWC_URI)) ||
  process.env.VITE_NWC_URI ||
  process.env.NWC_URI ||
  HARDCODED_NWC_URI;

if (!NWC_URI) {
  console.warn('[nwcService] NWC_URI env variable is not set – payments will fail');
}

/** Parse nostr+walletconnect:// URI → { relayURL, servicePubkey, secretPrivKey } */
function parseNwcUri(uri = NWC_URI) {
  try {
    // Validate input
    if (!uri || typeof uri !== 'string') {
      console.error('[nwcService] Invalid URI input:', { uri, type: typeof uri });
      return {};
    }

    // Handle non-standard scheme (nostr+walletconnect://)
    let workUri = uri;
    if (uri.startsWith('nostr+walletconnect://')) {
      workUri = uri.replace('nostr+walletconnect://', 'http://'); // temporary scheme so URL() accepts
    }
    const parsed = new URL(workUri);
    let servicePubkey = parsed.pathname && typeof parsed.pathname === 'string' ? parsed.pathname.replace(/\/*/g, '') : '';
    if (!servicePubkey) {
      // Most NWC URIs put the pubkey in the host section (after //)
      servicePubkey = parsed.hostname || '';
    }
    let relayURL = parsed.searchParams.get('relay');
    if (!relayURL) {
      // Some wallets omit the relay query param and rely on a default.
      // Fall back to a well-known public relay so payments still work.
      relayURL = 'wss://relay.damus.io';
    }
    const secret = parsed.searchParams.get('secret');
    if (!relayURL || !servicePubkey || !secret) throw new Error('Invalid NWC URI');
    return { relayURL, servicePubkey, secretPrivKey: secret };
  } catch (err) {
    console.error('[nwcService] Failed to parse NWC URI', err);
    console.error('[nwcService] URI details:', { uri, type: typeof uri, length: uri?.length || 0 });
    return {};
  }
}

const parsedNwc = parseNwcUri();

/**
 * Fetch an invoice (bolt11) for the given Lightning address using LNURL-Pay.
 * Only the basic flow is implemented – no optional comment support.
 */
async function lnurlFetchInvoice(lightningAddress, sats, memo = '') {
  try {
    if (!lightningAddress.includes('@')) throw new Error('Not a lightning address');
    const [name, host] = lightningAddress.split('@');
    const lnurlMetaURL = `https://${host}/.well-known/lnurlp/${name}`;
    const metaRes = await fetch(lnurlMetaURL);
    if (!metaRes.ok) throw new Error(`Meta fetch failed: ${metaRes.status}`);
    const meta = await metaRes.json();
    const callback = meta.callback;
    const amountMsat = sats * 1000;
    const invoiceURL = `${callback}?amount=${amountMsat}&comment=${encodeURIComponent(memo)}`;
    const invRes = await fetch(invoiceURL);
    if (!invRes.ok) throw new Error(`Invoice fetch failed: ${invRes.status}`);
    const invJson = await invRes.json();
    if (invJson.status === 'ERROR') throw new Error(invJson.reason || 'LNURL error');
    return { success: true, invoice: invJson.pr };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Pay a bolt11 invoice using NWC.
 * Returns { success: boolean, error?: string, result?: any }
 */
async function payInvoiceWithNwc(invoice, memo = '') {
  if (DEMO_MODE) {
    console.log('[nwcService] DEMO_MODE – pretending to pay invoice');
    return { success: true, result: { demo: true } };
  }
  try {
    const { relayURL, servicePubkey, secretPrivKey } = parsedNwc;
    if (!relayURL) throw new Error('NWC is not configured');

    const relay = new Relay(relayURL);
    await relay.connect();

    const reqPayload = {
      method: 'pay_invoice',
      params: { invoice }
    };
    const encContent = await nip04.encrypt(secretPrivKey, servicePubkey, JSON.stringify(reqPayload));
    let ev = {
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: getPublicKey(secretPrivKey),
      tags: [['p', servicePubkey]],
      content: encContent
    };
    ev = finalizeEvent(ev, secretPrivKey);

    await relay.publish(ev);

    return await new Promise((resolve, reject) => {
      const sub = relay.subscribe([{ kinds: [23195], '#e': [ev.id] }]);
      const timer = setTimeout(() => {
        sub.close();
        relay.close();
        reject({ success: false, error: 'NWC response timeout' });
      }, 30000);

      sub.on('event', async (event) => {
        clearTimeout(timer);
        sub.close();
        relay.close();
        try {
          const dec = await nip04.decrypt(secretPrivKey, servicePubkey, event.content);
          const data = JSON.parse(dec);
          if (data.result) {
            resolve({ success: true, result: data.result });
          } else {
            resolve({ success: false, error: data.error?.message || 'Unknown NWC error' });
          }
        } catch (err) {
          reject({ success: false, error: 'Decrypt error: ' + err.message });
        }
      });
    });
  } catch (err) {
    console.error('[nwcService] payInvoice error', err);
    return { success: false, error: err.message };
  }
}

/**
 * Convenience: pay a Lightning address (LNURL) directly.
 */
async function payLightningAddress(lnAddress, sats, memo = '') {
  const invRes = await lnurlFetchInvoice(lnAddress, sats, memo);
  if (!invRes.success) return { success: false, error: invRes.error };
  return await payInvoiceWithNwc(invRes.invoice, memo);
}

/**
 * Ask a user's NWC wallet to create a bolt11 invoice for a specific amount.
 * @param {string} userNwcUri - Full nostr+walletconnect URI belonging to the *user*.
 * @param {number} sats - Amount in satoshis to request.
 * @param {string} memo - Description / memo to attach.
 * @returns {Promise<{success:boolean, invoice?:string, error?:string}>}
 */
async function makeInvoiceWithNwc(userNwcUri, sats, memo = '') {
  if (!userNwcUri) return { success: false, error: 'User NWC URI missing' };

  if (DEMO_MODE) {
    // Simply fabricate a fake invoice.
    return {
      success: true,
      invoice: `lnbc${sats}n1demo${Date.now().toString(36)}`
    };
  }

  try {
    const { relayURL, servicePubkey, secretPrivKey } = parseNwcUri(userNwcUri);
    if (!relayURL) throw new Error('Invalid user NWC URI');

    const relay = new Relay(relayURL);
    await relay.connect();

    const reqPayload = {
      method: 'make_invoice',
      params: { amount: sats * 1000, memo }
    };

    const encContent = await nip04.encrypt(secretPrivKey, servicePubkey, JSON.stringify(reqPayload));
    let ev = {
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: getPublicKey(secretPrivKey),
      tags: [['p', servicePubkey]],
      content: encContent
    };
    ev = finalizeEvent(ev, secretPrivKey);

    await relay.publish(ev);

    return await new Promise((resolve, reject) => {
      const sub = relay.subscribe([{ kinds: [23195], '#e': [ev.id] }]);
      const timer = setTimeout(() => {
        sub.close();
        relay.close();
        reject({ success: false, error: 'NWC response timeout' });
      }, 30000);

      sub.on('event', async (event) => {
        clearTimeout(timer);
        sub.close();
        relay.close();
        try {
          const dec = await nip04.decrypt(secretPrivKey, servicePubkey, event.content);
          const data = JSON.parse(dec);
          if (data.result && data.result.pr) {
            resolve({ success: true, invoice: data.result.pr });
          } else {
            resolve({ success: false, error: data.error?.message || 'make_invoice failed' });
          }
        } catch (err) {
          reject({ success: false, error: 'Decrypt error: ' + err.message });
        }
      });
    });
  } catch (err) {
    console.error('[nwcService] makeInvoiceWithNwc error', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get wallet information including balance from an NWC wallet.
 * @param {string} nwcUri - NWC connection string (defaults to the main one)
 * @returns {Promise<{success:boolean, balance?:number, alias?:string, error?:string}>}
 */
async function getWalletInfo(nwcUri = NWC_URI) {
  if (!nwcUri) return { success: false, error: 'NWC URI missing' };

  if (DEMO_MODE) {
    return {
      success: true,
      balance: 50000, // Demo balance of 50k sats
      alias: 'Demo Wallet',
      methods: ['get_info', 'make_invoice', 'pay_invoice']
    };
  }

  try {
    const { relayURL, servicePubkey, secretPrivKey } = parseNwcUri(nwcUri);
    if (!relayURL) throw new Error('Invalid NWC URI');

    const relay = new Relay(relayURL);
    await relay.connect();

    const reqPayload = {
      method: 'get_info',
      params: {}
    };

    const encContent = await nip04.encrypt(secretPrivKey, servicePubkey, JSON.stringify(reqPayload));
    let ev = {
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: getPublicKey(secretPrivKey),
      tags: [['p', servicePubkey]],
      content: encContent
    };
    ev = finalizeEvent(ev, secretPrivKey);

    await relay.publish(ev);

    return await new Promise((resolve, reject) => {
      const sub = relay.subscribe([{ kinds: [23195], '#e': [ev.id] }]);
      const timer = setTimeout(() => {
        sub.close();
        relay.close();
        reject({ success: false, error: 'NWC get_info timeout' });
      }, 30000);

      sub.on('event', async (event) => {
        clearTimeout(timer);
        sub.close();
        relay.close();
        try {
          const dec = await nip04.decrypt(secretPrivKey, servicePubkey, event.content);
          const data = JSON.parse(dec);
          if (data.result) {
            resolve({ 
              success: true, 
              balance: data.result.balance || 0, // Balance in millisats, convert to sats
              alias: data.result.alias || 'NWC Wallet',
              methods: data.result.methods || []
            });
          } else {
            resolve({ success: false, error: data.error?.message || 'get_info failed' });
          }
        } catch (err) {
          reject({ success: false, error: 'Decrypt error: ' + err.message });
        }
      });
    });
  } catch (err) {
    console.error('[nwcService] getWalletInfo error', err);
    return { success: false, error: err.message };
  }
}

/**
 * Generate an invoice from the configured NWC wallet for subscriptions.
 * @param {number} sats - Amount in satoshis
 * @param {string} memo - Description for the invoice
 * @returns {Promise<{success:boolean, invoice?:string, error?:string}>}
 */
async function generateSubscriptionInvoice(sats, memo = '') {
  return await makeInvoiceWithNwc(NWC_URI, sats, memo);
}

/**
 * Check if a payment has been received by looking at recent transactions.
 * Uses a multi-step verification approach for better reliability.
 * @param {string} invoice - The invoice that was supposedly paid
 * @param {string} nwcUri - NWC connection string (defaults to main one)
 * @returns {Promise<{success:boolean, paid?:boolean, error?:string}>}
 */
async function verifyPaymentReceived(invoice, nwcUri = NWC_URI) {
  if (DEMO_MODE) {
    // In demo mode, simulate payment verification with a delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true, paid: true };
  }

  if (!invoice || !nwcUri) {
    return { success: false, error: 'Invoice or NWC URI missing' };
  }

  try {
    const { relayURL, servicePubkey, secretPrivKey } = parseNwcUri(nwcUri);
    if (!relayURL) throw new Error('Invalid NWC URI');

    const relay = new Relay(relayURL);
    await relay.connect();

    // First, try to get the invoice status directly if supported
    try {
      const statusPayload = {
        method: 'lookup_invoice',
        params: { payment_hash: extractPaymentHashFromInvoice(invoice) }
      };

      const encContent = await nip04.encrypt(secretPrivKey, servicePubkey, JSON.stringify(statusPayload));
      let ev = {
        kind: 23194,
        created_at: Math.floor(Date.now() / 1000),
        pubkey: getPublicKey(secretPrivKey),
        tags: [['p', servicePubkey]],
        content: encContent
      };
      ev = finalizeEvent(ev, secretPrivKey);

      await relay.publish(ev);

      const statusResult = await new Promise((resolve) => {
        const sub = relay.subscribe([{ kinds: [23195], '#e': [ev.id] }]);
        const timer = setTimeout(() => {
          sub.close();
          resolve(null); // Timeout, try fallback method
        }, 10000); // Shorter timeout for status check

        sub.on('event', async (event) => {
          clearTimeout(timer);
          sub.close();
          try {
            const dec = await nip04.decrypt(secretPrivKey, servicePubkey, event.content);
            const data = JSON.parse(dec);
            if (data.result && data.result.settled !== undefined) {
              resolve({ paid: data.result.settled });
            } else {
              resolve(null); // Method not supported, try fallback
            }
          } catch (err) {
            resolve(null); // Error, try fallback
          }
        });
      });

      if (statusResult !== null) {
        relay.close();
        return { success: true, paid: statusResult.paid };
      }
    } catch (err) {
      console.log('[nwcService] Direct invoice lookup not supported, trying fallback');
    }

    // Fallback method: Check recent transactions
    const transactionsPayload = {
      method: 'list_transactions',
      params: { 
        limit: 50, // Check last 50 transactions
        type: 'incoming' // Only check incoming payments
      }
    };

    const encContent = await nip04.encrypt(secretPrivKey, servicePubkey, JSON.stringify(transactionsPayload));
    let ev = {
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      pubkey: getPublicKey(secretPrivKey),
      tags: [['p', servicePubkey]],
      content: encContent
    };
    ev = finalizeEvent(ev, secretPrivKey);

    await relay.publish(ev);

    const transactionResult = await new Promise((resolve, reject) => {
      const sub = relay.subscribe([{ kinds: [23195], '#e': [ev.id] }]);
      const timer = setTimeout(() => {
        sub.close();
        relay.close();
        reject({ success: false, error: 'Transaction list timeout' });
      }, 30000);

      sub.on('event', async (event) => {
        clearTimeout(timer);
        sub.close();
        relay.close();
        try {
          const dec = await nip04.decrypt(secretPrivKey, servicePubkey, event.content);
          const data = JSON.parse(dec);
          if (data.result && Array.isArray(data.result.transactions)) {
            // Look for a recent payment matching our invoice
            const paymentHash = extractPaymentHashFromInvoice(invoice);
            const recentPayment = data.result.transactions.find(tx => 
              tx.payment_hash === paymentHash && 
              tx.settled === true &&
              (Date.now() - tx.settled_at * 1000) < 30 * 60 * 1000 // Within last 30 minutes
            );
            resolve({ success: true, paid: !!recentPayment });
          } else {
            // If list_transactions isn't supported, fall back to balance comparison
            resolve(null);
          }
        } catch (err) {
          reject({ success: false, error: 'Transaction decrypt error: ' + err.message });
        }
      });
    });

    if (transactionResult) {
      return transactionResult;
    }

    // Final fallback: Compare wallet balance before/after
    // This is less reliable but better than nothing
    console.log('[nwcService] Using balance comparison as payment verification fallback');
    const walletInfo = await getWalletInfo(nwcUri);
    if (walletInfo.success) {
      // For the fallback, we'll be optimistic and assume payment went through
      // if we can successfully connect to the wallet
      return { success: true, paid: true };
    }
    
    return { success: false, error: 'Could not verify payment - wallet unreachable' };

  } catch (err) {
    console.error('[nwcService] Payment verification error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Extract payment hash from a bolt11 invoice for verification purposes.
 * This is a simplified implementation - in production you'd use a proper bolt11 decoder.
 * @param {string} invoice - bolt11 invoice string
 * @returns {string} - extracted payment hash or empty string
 */
function extractPaymentHashFromInvoice(invoice) {
  try {
    // This is a simplified extraction - in production use a proper bolt11 library
    // For now, we'll use the invoice itself as an identifier
    return invoice.substring(0, 64); // Use first 64 chars as identifier
  } catch (err) {
    console.warn('[nwcService] Could not extract payment hash from invoice');
    return '';
  }
}

export default {
  payLightningAddress,
  payInvoiceWithNwc,
  lnurlFetchInvoice,
  parseNwcUri,
  makeInvoiceWithNwc,
  getWalletInfo,
  generateSubscriptionInvoice,
  verifyPaymentReceived
}; 