/**
 * Season Pass Payment Service - Handles payment generation and processing for RUNSTR Season 1
 * 
 * This service generates Lightning invoices for season pass purchases using the
 * RUNSTR reward wallet, and handles payment verification.
 */

import { NWCWallet } from './nwcWallet.jsx';
import seasonPassService from './seasonPassService';
import { REWARDS } from '../config/rewardsConfig';

// RUNSTR Reward NWC URI - Updated January 2025
const RUNSTR_REWARD_NWC_URI = "nostr+walletconnect://bc8032a1af649b90f45a8395c5054d8b45dacf6f3e99b99d6c11206e887f10e2?relay=wss://relay.getalby.com/v1&secret=8793aaf0eab13050cd52542d8b711b240511d80a84324a8a948ab7a81d3fba26&lud16=hustle@getalby.com";

export interface SeasonPassPaymentResult {
  success: boolean;
  invoice?: string;
  error?: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  error?: string;
  alreadyParticipant?: boolean;
}

class SeasonPassPaymentService {
  private wallet: NWCWallet | null = null;
  private isConnecting = false;
  private connectionPromise: Promise<boolean> | null = null;

  /**
   * Ensure the RUNSTR reward wallet is connected
   */
  private async ensureWalletConnected(): Promise<boolean> {
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
  private async connectWallet(): Promise<boolean> {
    try {
      console.log('[SeasonPassPayment] Connecting to RUNSTR reward wallet...');
      console.log('[SeasonPassPayment] NWC URI preview:', RUNSTR_REWARD_NWC_URI.substring(0, 50) + '...');
      
      this.wallet = new NWCWallet();
      await this.wallet.connect(RUNSTR_REWARD_NWC_URI);
      
      console.log('[SeasonPassPayment] RUNSTR reward wallet connected successfully.');
      console.log('[SeasonPassPayment] Wallet provider available:', !!this.wallet.provider);
      
      return true;
    } catch (error) {
      console.error('[SeasonPassPayment] Failed to connect to RUNSTR reward wallet:', error);
      console.error('[SeasonPassPayment] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.substring(0, 200) + '...' : 'No stack trace'
      });
      
      this.wallet = null;
      throw new Error(`Failed to connect to payment wallet: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  }

  /**
   * Generate a Lightning invoice for season pass purchase
   * @param userPubkey The user's public key (for tracking)
   * @returns Payment result with invoice or error
   */
  async generateSeasonPassInvoice(userPubkey: string): Promise<SeasonPassPaymentResult> {
    try {
      // Check if user is already a participant
      if (seasonPassService.isParticipant(userPubkey)) {
        return {
          success: false,
          error: 'You already have a Season Pass!'
        };
      }

      // Ensure wallet is connected
      await this.ensureWalletConnected();

      if (!this.wallet?.provider) {
        throw new Error('Wallet connection failed');
      }

      const { passPrice, title } = REWARDS.SEASON_1;
      const memo = `${title} Season Pass - ${passPrice} sats`;

      console.log(`[SeasonPassPayment] Generating invoice for ${passPrice} sats for user ${userPubkey}`);

      // Generate invoice using the wallet makeInvoice method
      console.log('[SeasonPassPayment] Requesting invoice with params:', { amount: passPrice, memo });
      
      const invoiceResult = await this.wallet.makeInvoice({
        amount: passPrice,
        defaultMemo: memo
      });

      console.log('[SeasonPassPayment] Invoice result received:', invoiceResult);
      console.log('[SeasonPassPayment] Invoice result analysis:', {
        hasResult: !!invoiceResult,
        resultType: typeof invoiceResult,
        hasInvoice: !!invoiceResult?.invoice,
        invoiceType: typeof invoiceResult?.invoice,
        invoicePreview: invoiceResult?.invoice?.substring(0, 50) + '...',
        resultKeys: invoiceResult ? Object.keys(invoiceResult) : 'no result',
        fullResult: JSON.stringify(invoiceResult)
      });

      if (!invoiceResult || !invoiceResult.invoice) {
        const errorDetails = {
          hasResult: !!invoiceResult,
          resultKeys: invoiceResult ? Object.keys(invoiceResult) : [],
          fullResult: JSON.stringify(invoiceResult)
        };
        throw new Error(`Failed to generate invoice - no invoice returned from wallet provider. Details: ${JSON.stringify(errorDetails)}`);
      }

      console.log('[SeasonPassPayment] Successfully generated season pass invoice');

      return {
        success: true,
        invoice: invoiceResult.invoice
      };

    } catch (error) {
      console.error('[SeasonPassPayment] Error generating season pass invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate payment invoice'
      };
    }
  }

  /**
   * Verify payment and add user to participants list
   * @param userPubkey The user's public key
   * @param paymentHash Optional payment hash for verification (if available)
   * @returns Verification result
   */
  async verifyPaymentAndAddParticipant(userPubkey: string, paymentHash?: string): Promise<PaymentVerificationResult> {
    try {
      // Check if user is already a participant
      if (seasonPassService.isParticipant(userPubkey)) {
        return {
          success: true,
          alreadyParticipant: true
        };
      }

      // Add user to participants list
      // Note: In a production system, you'd verify the payment hash against the Lightning network
      // For now, we trust that the user clicked "I have paid" after actually paying
      seasonPassService.addParticipant(userPubkey);

      console.log(`[SeasonPassPayment] Added user ${userPubkey} to Season Pass participants`);

      return {
        success: true
      };

    } catch (error) {
      console.error('[SeasonPassPayment] Error verifying payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify payment'
      };
    }
  }

  /**
   * Check if a user already has a season pass
   * @param userPubkey The user's public key
   * @returns true if user has season pass, false otherwise
   */
  hasSeasonPass(userPubkey: string): boolean {
    return seasonPassService.isParticipant(userPubkey);
  }

  /**
   * Get current season pass details
   */
  getSeasonDetails() {
    return REWARDS.SEASON_1;
  }

  /**
   * Get participant count for display
   */
  getParticipantCount(): number {
    return seasonPassService.getParticipantCount();
  }

  /**
   * Cleanup wallet connection
   */
  async disconnect(): Promise<void> {
    try {
      if (this.wallet) {
        await this.wallet.disconnect();
        this.wallet = null;
      }
    } catch (error) {
      console.error('[SeasonPassPayment] Error disconnecting wallet:', error);
    }
  }
}

// Export singleton instance
const seasonPassPaymentService = new SeasonPassPaymentService();
export default seasonPassPaymentService; 