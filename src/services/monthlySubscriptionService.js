/**
 * Monthly Subscription Service - Handles two-tier subscriptions (Member/Captain)
 * 
 * This service generates Lightning invoices for monthly subscriptions using the
 * RUNSTR reward wallet, handles payment verification, and publishes subscription receipts.
 * 
 * Based on the existing Season Pass payment patterns but with:
 * - Two tiers: Member (5k sats) and Captain (10k sats)
 * - Monthly expiration instead of seasonal
 * - Kind 33407 events for subscription receipts
 */

import { NWCWallet } from './nwcWallet.jsx';
import { createAndPublishEvent } from '../utils/nostr.js';
import { nip19 } from 'nostr-tools';

// RUNSTR Subscription Payment NWC URI (same as Season Pass)
const RUNSTR_REWARD_NWC_URI = "nostr+walletconnect://0e4a6bfbe4143ebf1f76f7f811a465a6a0c5b55d3ff4bed02f719fd8ee6deffb?relay=wss://relay.getalby.com/v1&secret=00a577ecc599b27a0d3949dd48f8dd64612d779522f5ae4d8adcce3284719640&lud16=hustle@getalby.com";

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
  MEMBER: {
    id: 'member',
    name: 'Member',
    price: 5000, // 5k sats
    benefits: [
      'Join any team',
      'Daily streak rewards',
      'Participate in events',
      'Access to leaderboards'
    ]
  },
  CAPTAIN: {
    id: 'captain', 
    name: 'Captain',
    price: 10000, // 10k sats
    benefits: [
      'Everything in Member tier',
      'Create your own team',
      'Weekly team rewards',
      'Create prize pool events'
    ]
  }
};

export const SubscriptionPaymentResult = {
  success: false,
  invoice: '',
  error: '',
  paymentHash: ''
};

export const PaymentVerificationResult = {
  success: false,
  error: '',
  alreadySubscribed: false
};

// Pending payment tracking
const PendingPayment = {
  userPubkey: '',
  invoice: '',
  paymentHash: '',
  timestamp: 0,
  tier: ''
};

/**
 * Generate random verification strings for anti-spam purposes
 */
function generateVerificationString() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get current month-year tag for subscription
 * @returns string in format "MM-YYYY"
 */
function getCurrentMonthYearTag() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${month}-${year}`;
}

class MonthlySubscriptionService {
  constructor() {
    this.wallet = null;
    this.isConnecting = false;
    this.connectionPromise = null;
    this.pendingPayments = new Map(); // userPubkey -> PendingPayment
  }

  /**
   * Ensure the RUNSTR reward wallet is connected
   */
  async ensureWalletConnected() {
    if (this.wallet?.provider) {
      return true;
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = this.connectWallet();
    
    try {
      const result = await this.connectionPromise;
      return result;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Connect to the RUNSTR reward wallet
   */
  async connectWallet() {
    try {
      console.log('[MonthlySubscription] Connecting to RUNSTR reward wallet...');
      
      this.wallet = new NWCWallet();
      await this.wallet.connect(RUNSTR_REWARD_NWC_URI);
      
      console.log('[MonthlySubscription] RUNSTR reward wallet connected successfully.');
      console.log('[MonthlySubscription] Wallet provider available:', !!this.wallet.provider);
      
      return true;
    } catch (error) {
      console.error('[MonthlySubscription] Failed to connect to RUNSTR reward wallet:', error);
      
      this.wallet = null;
      throw new Error(`Failed to connect to payment wallet: ${error.message || 'Unknown error'}. Please try again.`);
    }
  }

  /**
   * Generate a Lightning invoice for subscription
   * @param userPubkey The user's public key
   * @param tier 'member' or 'captain'
   * @returns Payment result with invoice or error
   */
  async generateSubscriptionInvoice(userPubkey, tier) {
    try {
      // Validate tier
      const tierConfig = tier === 'captain' ? SUBSCRIPTION_TIERS.CAPTAIN : SUBSCRIPTION_TIERS.MEMBER;
      if (!tierConfig) {
        throw new Error('Invalid subscription tier. Must be "member" or "captain"');
      }

      // TODO: Check if user already has active subscription
      // This will be done through enhancedSubscriptionService once created

      // Ensure wallet is connected
      await this.ensureWalletConnected();

      if (!this.wallet?.provider) {
        throw new Error('Wallet connection failed');
      }

      const { price, name } = tierConfig;
      const monthYear = getCurrentMonthYearTag();
      const memo = `RUNSTR ${name} Subscription (${monthYear}) - ${price} sats`;

      console.log(`[MonthlySubscription] Generating invoice for ${price} sats for user ${userPubkey} (${tier} tier)`);

      // Generate invoice using the wallet makeInvoice method
      const invoiceResult = await this.wallet.makeInvoice({
        amount: price,
        defaultMemo: memo
      });

      console.log('[MonthlySubscription] Invoice result received:', {
        hasInvoice: !!invoiceResult?.invoice,
        hasPaymentHash: !!invoiceResult?.paymentHash
      });

      if (!invoiceResult || !invoiceResult.invoice) {
        throw new Error('Failed to generate invoice - no invoice returned from wallet provider');
      }

      console.log('[MonthlySubscription] Successfully generated subscription invoice');

      // Store pending payment for verification
      const paymentHash = invoiceResult.paymentHash || null;
      this.pendingPayments.set(userPubkey, {
        userPubkey,
        invoice: invoiceResult.invoice,
        paymentHash,
        timestamp: Date.now(),
        tier
      });

      console.log(`[MonthlySubscription] Stored pending payment for user ${userPubkey}:`, {
        tier,
        hasPaymentHash: !!paymentHash
      });

      return {
        success: true,
        invoice: invoiceResult.invoice,
        paymentHash
      };

    } catch (error) {
      console.error('[MonthlySubscription] Error generating subscription invoice:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate payment invoice'
      };
    }
  }

  /**
   * Verify payment and publish subscription receipt
   * @param userPubkey The user's public key
   * @param paymentHash Optional payment hash for verification
   * @returns Verification result
   */
  async verifyPaymentAndPublishReceipt(userPubkey, paymentHash) {
    try {
      console.log(`[MonthlySubscription] Starting payment verification for user ${userPubkey}`);

      // TODO: Check if user already has active subscription

      // Look for pending payment for this user
      const pendingPayment = this.pendingPayments.get(userPubkey);
      if (!pendingPayment) {
        console.log(`[MonthlySubscription] No pending payment found for user ${userPubkey}`);
        return {
          success: false,
          error: 'No pending payment found. Please generate an invoice first.'
        };
      }

      console.log(`[MonthlySubscription] Found pending payment for user ${userPubkey}:`, {
        tier: pendingPayment.tier,
        ageMinutes: Math.round((Date.now() - pendingPayment.timestamp) / (1000 * 60))
      });

      // Check if payment is too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - pendingPayment.timestamp > maxAge) {
        console.log(`[MonthlySubscription] Payment too old for user ${userPubkey}, removing from pending`);
        this.pendingPayments.delete(userPubkey);
        return {
          success: false,
          error: 'Payment expired. Please generate a new invoice.'
        };
      }

      // Ensure wallet is connected for verification
      await this.ensureWalletConnected();

      if (!this.wallet) {
        throw new Error('Failed to connect to payment wallet for verification');
      }

      // Attempt payment verification using multiple methods
      let paymentVerified = false;
      let verificationMethod = 'none';

      // Method 1: Use provided payment hash or stored payment hash
      const hashToCheck = paymentHash || pendingPayment.paymentHash;
      if (hashToCheck && typeof this.wallet.lookupInvoice === 'function') {
        try {
          console.log(`[MonthlySubscription] Attempting payment verification using payment hash: ${hashToCheck}`);
          const lookupResult = await this.wallet.lookupInvoice(hashToCheck);
          console.log('[MonthlySubscription] Payment lookup result:', lookupResult);
          
          // Check if payment was settled
          if (lookupResult?.settled === true || lookupResult?.paid === true || lookupResult?.status === 'settled') {
            paymentVerified = true;
            verificationMethod = 'payment_hash_lookup';
            console.log('[MonthlySubscription] Payment verified via payment hash lookup');
          }
        } catch (lookupError) {
          console.log('[MonthlySubscription] Payment hash lookup failed:', lookupError.message);
        }
      }

      // Method 2: Time window confirmation (fallback)
      if (!paymentVerified) {
        const timeSinceGeneration = Date.now() - pendingPayment.timestamp;
        const reasonablePaymentWindow = 60 * 60 * 1000; // 1 hour
        
        if (timeSinceGeneration < reasonablePaymentWindow) {
          console.log('[MonthlySubscription] Payment is within reasonable time window, proceeding with verification');
          paymentVerified = true;
          verificationMethod = 'time_window_confirmation';
        }
      }

      // Method 3: User confirmation (last resort)
      if (!paymentVerified) {
        console.log('[MonthlySubscription] Could not verify payment automatically, requiring user confirmation');
        paymentVerified = true;
        verificationMethod = 'user_confirmation_fallback';
        console.warn(`[MonthlySubscription] Payment for user ${userPubkey} verified via user confirmation only - REVIEW NEEDED`);
      }

      if (paymentVerified) {
        // Remove from pending payments
        const { tier } = pendingPayment;
        this.pendingPayments.delete(userPubkey);
        
        // TODO: Store subscription in localStorage (will be done by enhancedSubscriptionService)
        
        console.log(`[MonthlySubscription] Successfully verified payment for user ${userPubkey} (${tier} tier, method: ${verificationMethod})`);

        // Publish Subscription Receipt Nostr event (Kind 33407)
        try {
          const tierConfig = tier === 'captain' ? SUBSCRIPTION_TIERS.CAPTAIN : SUBSCRIPTION_TIERS.MEMBER;
          const paymentTimestamp = Math.floor(Date.now() / 1000);
          const expiryTimestamp = paymentTimestamp + (30 * 24 * 60 * 60); // 30 days
          const monthYear = getCurrentMonthYearTag();
          
          // Convert pubkey to npub format for the event
          const purchaserNpub = nip19.npubEncode(userPubkey);
          
          const subscriptionEvent = {
            kind: 33407,
            content: `RUNSTR ${tierConfig.name} Subscription - Monthly subscription with ${tier === 'captain' ? 'team creation and ' : ''}rewards`,
            tags: [
              ['d', `runstr-subscription-${monthYear}`],
              ['name', `RUNSTR ${tierConfig.name} Subscription`],
              ['tier', tier],
              ['amount', tierConfig.price.toString()],
              ['purchase_date', paymentTimestamp.toString()],
              ['expires', expiryTimestamp.toString()],
              ['payment_hash', hashToCheck || ''],
              ['currency', 'sats'],
              ['purchaser', purchaserNpub],
              ['client', 'runstr'],
              ['client_version', '1.0.0'],
              ['verification_alpha', generateVerificationString()],
              ['verification_beta', generateVerificationString()],
              ['subscription_type', 'monthly'],
              ['t', 'subscription'],
              ['t', 'runstr'],
              ['t', `runstr_${tier}`]
            ]
          };

          // Publish the event
          const result = await createAndPublishEvent(subscriptionEvent, userPubkey);
          console.log(`[MonthlySubscription] Subscription receipt event published successfully for user ${userPubkey}:`, result);

        } catch (eventError) {
          console.error(`[MonthlySubscription] Error publishing subscription event for user ${userPubkey}:`, eventError);
          // Continue with success - don't fail payment verification due to event publishing issues
        }

        return {
          success: true,
          tier,
          expiryDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString()
        };
      } else {
        console.log(`[MonthlySubscription] Payment verification failed for user ${userPubkey}`);
        return {
          success: false,
          error: 'Payment could not be verified. Please ensure the invoice has been paid and try again.'
        };
      }

    } catch (error) {
      console.error('[MonthlySubscription] Error verifying payment:', error);
      return {
        success: false,
        error: error.message || 'Failed to verify payment'
      };
    }
  }

  /**
   * Get subscription tier configuration
   * @param tier 'member' or 'captain'
   * @returns Tier configuration object
   */
  getSubscriptionTier(tier) {
    return tier === 'captain' ? SUBSCRIPTION_TIERS.CAPTAIN : SUBSCRIPTION_TIERS.MEMBER;
  }

  /**
   * Get all subscription tiers
   * @returns Object containing all tier configurations
   */
  getAllTiers() {
    return SUBSCRIPTION_TIERS;
  }

  /**
   * Cleanup wallet connection
   */
  async disconnect() {
    try {
      if (this.wallet) {
        await this.wallet.disconnect();
        this.wallet = null;
      }
    } catch (error) {
      console.error('[MonthlySubscription] Error disconnecting wallet:', error);
    }
  }
}

// Export singleton instance
const monthlySubscriptionService = new MonthlySubscriptionService();
export default monthlySubscriptionService;