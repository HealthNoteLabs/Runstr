import nwcService from './nwcService.js';
import { REWARDS } from '../config/rewardsConfig';
import { 
  prepareTeamSubscriptionReceiptEvent,
  fetchSubscriptionReceipts 
} from './nostr/NostrTeamsService';
import { createAndPublishEvent } from '../utils/nostr';

export type Season1Tier = 'member' | 'captain';

export interface SubscriptionInvoice {
  invoice: string;
  amount: number;
  tier: Season1Tier;
  expires: number; // Unix timestamp
}

export interface WalletBalance {
  balance: number; // sats
  alias: string;
  success: boolean;
  error?: string;
}

/**
 * Service for handling Season 1 subscriptions via NWC invoice generation
 */
export class SubscriptionService {
  private static instance: SubscriptionService;
  private nwcUri: string;

  constructor() {
    this.nwcUri = REWARDS.SEASON_1.subscriptionNwcUri;
  }

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  /**
   * Generate an invoice for Season 1 subscription
   */
  async generateSubscriptionInvoice(
    tier: Season1Tier, 
    userPubkey: string
  ): Promise<{ success: boolean; invoice?: SubscriptionInvoice; error?: string }> {
    try {
      const amount = tier === 'captain' ? REWARDS.SEASON_1.captainFee : REWARDS.SEASON_1.memberFee;
      const memo = `RUNSTR Season 1 ${tier} subscription for ${userPubkey.slice(0, 8)}...`;

      console.log(`[SubscriptionService] Generating invoice for ${tier} subscription: ${amount} sats`);
      
      const result = await nwcService.makeInvoiceWithNwc(this.nwcUri, amount, memo);
      
      if (result.success && result.invoice) {
        const subscriptionInvoice: SubscriptionInvoice = {
          invoice: result.invoice,
          amount,
          tier,
          expires: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes from now
        };

        console.log(`[SubscriptionService] Successfully generated ${tier} invoice`);
        return { success: true, invoice: subscriptionInvoice };
      } else {
        console.error(`[SubscriptionService] Failed to generate invoice:`, result.error);
        return { success: false, error: result.error || 'Failed to generate invoice' };
      }
    } catch (error: any) {
      console.error(`[SubscriptionService] Error generating subscription invoice:`, error);
      return { success: false, error: error.message || 'Unknown error generating invoice' };
    }
  }

  /**
   * Verify that a subscription payment was received
   */
  async verifySubscriptionPayment(
    invoice: string,
    userPubkey: string,
    tier: Season1Tier
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[SubscriptionService] Verifying payment for ${tier} subscription`);
      
      const result = await nwcService.verifyPaymentReceived(invoice, this.nwcUri);
      
      if (result.success && result.paid) {
        console.log(`[SubscriptionService] Payment verified for ${tier} subscription`);
        return { success: true };
      } else {
        console.warn(`[SubscriptionService] Payment not verified:`, result.error);
        return { success: false, error: result.error || 'Payment not verified' };
      }
    } catch (error: any) {
      console.error(`[SubscriptionService] Error verifying payment:`, error);
      return { success: false, error: error.message || 'Unknown error verifying payment' };
    }
  }

  /**
   * Complete subscription process: create and publish receipt
   */
  async completeSubscription(
    userPubkey: string,
    tier: Season1Tier,
    amount: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[SubscriptionService] Completing ${tier} subscription for user`);
      
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = new Date(REWARDS.SEASON_1.endDate).getTime() / 1000;
      
      const receiptTemplate = prepareTeamSubscriptionReceiptEvent(
        REWARDS.SEASON_1.identifier,
        userPubkey,
        amount,
        startTime,
        endTime
      );
      
      if (!receiptTemplate) {
        return { success: false, error: 'Failed to prepare subscription receipt' };
      }
      
      await createAndPublishEvent(receiptTemplate, null);
      
      console.log(`[SubscriptionService] Successfully completed ${tier} subscription`);
      return { success: true };
    } catch (error: any) {
      console.error(`[SubscriptionService] Error completing subscription:`, error);
      return { success: false, error: error.message || 'Unknown error completing subscription' };
    }
  }

  /**
   * Get current wallet balance for subscription collection
   */
  async getCollectionWalletBalance(): Promise<WalletBalance> {
    try {
      console.log(`[SubscriptionService] Fetching wallet balance`);
      
      const result = await nwcService.getWalletInfo(this.nwcUri);
      
      if (result.success) {
        return {
          balance: Math.floor(result.balance / 1000), // Convert from millisats to sats
          alias: result.alias || 'Season 1 Collection Wallet',
          success: true
        };
      } else {
        console.error(`[SubscriptionService] Failed to get wallet balance:`, result.error);
        return {
          balance: 0,
          alias: 'Unknown',
          success: false,
          error: result.error || 'Failed to fetch wallet balance'
        };
      }
    } catch (error: any) {
      console.error(`[SubscriptionService] Error fetching wallet balance:`, error);
      return {
        balance: 0,
        alias: 'Unknown',
        success: false,
        error: error.message || 'Unknown error fetching balance'
      };
    }
  }

  /**
   * Full subscription flow: generate invoice, wait for payment, complete subscription
   */
  async processSubscription(
    userPubkey: string,
    tier: Season1Tier
  ): Promise<{ 
    success: boolean; 
    invoice?: SubscriptionInvoice; 
    error?: string; 
    requiresPayment?: boolean;
  }> {
    try {
      // Generate invoice
      const invoiceResult = await this.generateSubscriptionInvoice(tier, userPubkey);
      
      if (!invoiceResult.success || !invoiceResult.invoice) {
        return { 
          success: false, 
          error: invoiceResult.error || 'Failed to generate invoice' 
        };
      }

      // Return invoice for user to pay
      return {
        success: true,
        invoice: invoiceResult.invoice,
        requiresPayment: true
      };
    } catch (error: any) {
      console.error(`[SubscriptionService] Error processing subscription:`, error);
      return { 
        success: false, 
        error: error.message || 'Unknown error processing subscription' 
      };
    }
  }

  /**
   * Complete subscription after payment verification
   */
  async finalizeSubscription(
    invoice: string,
    userPubkey: string,
    tier: Season1Tier,
    amount: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify payment was received
      const verificationResult = await this.verifySubscriptionPayment(invoice, userPubkey, tier);
      
      if (!verificationResult.success) {
        return { 
          success: false, 
          error: verificationResult.error || 'Payment verification failed' 
        };
      }

      // Complete subscription
      return await this.completeSubscription(userPubkey, tier, amount);
    } catch (error: any) {
      console.error(`[SubscriptionService] Error finalizing subscription:`, error);
      return { 
        success: false, 
        error: error.message || 'Unknown error finalizing subscription' 
      };
    }
  }
}

export default SubscriptionService.getInstance(); 