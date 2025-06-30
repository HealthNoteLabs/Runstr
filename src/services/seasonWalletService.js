import { SEASON_1_CONFIG } from '../config/seasonConfig.js';
import nwcService from './nwcService.js';
import { registerForSeason } from './seasonPassService.js';

/**
 * Season Wallet Service
 * Handles NWC wallet connection and payment processing specifically 
 * for RUNSTR Season 1 pass purchases and balance checking.
 */

class SeasonWalletService {
  constructor() {
    this.walletConnected = false;
    this.walletConnection = null;
    this.balance = 0;
    this.lastBalanceUpdate = null;
    this.connectionError = null;
    
    // Use the NWC connection string from config
    this.nwcConnectionString = SEASON_1_CONFIG.nwcConnectionString;
    this.parsedConnection = null;
    
    // Initialize connection
    this.initialize();
  }

  /**
   * Initialize the wallet connection
   */
  async initialize() {
    try {
      console.log('[SeasonWalletService] Initializing season wallet...');
      
      // Parse the NWC connection string
      this.parsedConnection = nwcService.parseNwcUri(this.nwcConnectionString);
      
      if (!this.parsedConnection.relayURL || !this.parsedConnection.servicePubkey) {
        throw new Error('Invalid NWC connection string in configuration');
      }

      console.log('[SeasonWalletService] NWC connection parsed successfully');
      console.log('[SeasonWalletService] Relay:', this.parsedConnection.relayURL);
      console.log('[SeasonWalletService] Service pubkey:', this.parsedConnection.servicePubkey.substring(0, 8) + '...');
      
      this.walletConnected = true;
      this.connectionError = null;
      
      // Fetch initial balance
      await this.updateBalance();
      
    } catch (error) {
      console.error('[SeasonWalletService] Initialization failed:', error);
      this.connectionError = error.message;
      this.walletConnected = false;
    }
  }

  /**
   * Check if wallet is connected and ready
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.walletConnected && this.parsedConnection && !this.connectionError;
  }

  /**
   * Get wallet connection status and details
   * @returns {object} Status information
   */
  getStatus() {
    return {
      connected: this.isConnected(),
      balance: this.balance,
      lastBalanceUpdate: this.lastBalanceUpdate,
      connectionError: this.connectionError,
      lud16: this.parsedConnection?.lud16 || 'RUNSTR@coinos.io',
      relayUrl: this.parsedConnection?.relayURL
    };
  }

  /**
   * Update wallet balance (receive-only wallet)
   * Note: This is a placeholder - actual balance checking would require 
   * additional NWC methods or external API calls
   */
  async updateBalance() {
    try {
      console.log('[SeasonWalletService] Updating balance...');
      
      // For now, this is a placeholder since NWC doesn't have standard balance checking
      // In production, you might:
      // 1. Use a separate API to check the wallet balance
      // 2. Track payments through webhook notifications
      // 3. Use Lightning address balance endpoints if available
      
      this.lastBalanceUpdate = new Date().toISOString();
      
      // Placeholder balance - in production this would be actual balance
      // For testing, you could set this to a known value
      console.log('[SeasonWalletService] Balance update completed (placeholder)');
      
      return { 
        success: true, 
        balance: this.balance, 
        lastUpdated: this.lastBalanceUpdate 
      };
      
    } catch (error) {
      console.error('[SeasonWalletService] Balance update failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create an invoice for season pass purchase
   * @param {string} userPubkey - User's public key making the purchase
   * @param {string} memo - Optional memo for the invoice
   * @returns {object} Invoice creation result
   */
  async createSeasonPassInvoice(userPubkey, memo = '') {
    try {
      if (!this.isConnected()) {
        throw new Error('Season wallet not connected');
      }

      const defaultMemo = memo || `RUNSTR Season 1 Pass - ${userPubkey.substring(0, 8)}...`;
      
      console.log('[SeasonWalletService] Creating season pass invoice...');
      console.log('[SeasonWalletService] Amount:', SEASON_1_CONFIG.seasonPassPrice, 'sats');
      console.log('[SeasonWalletService] User:', userPubkey.substring(0, 8) + '...');

      // Use the season-specific NWC connection to create an invoice
      const invoiceResult = await nwcService.makeInvoiceWithNwc(
        this.nwcConnectionString,
        SEASON_1_CONFIG.seasonPassPrice,
        defaultMemo
      );

      if (!invoiceResult.success) {
        throw new Error(invoiceResult.error || 'Failed to create invoice');
      }

      console.log('[SeasonWalletService] Invoice created successfully');
      
      return {
        success: true,
        invoice: invoiceResult.invoice,
        amount: SEASON_1_CONFIG.seasonPassPrice,
        memo: defaultMemo,
        userPubkey,
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[SeasonWalletService] Invoice creation failed:', error);
      return { 
        success: false, 
        error: error.message,
        userPubkey 
      };
    }
  }

  /**
   * Process season pass payment after invoice is paid
   * @param {string} userPubkey - User's public key
   * @param {object} paymentDetails - Payment transaction details
   * @returns {object} Registration result
   */
  async processSeasonPassPayment(userPubkey, paymentDetails) {
    try {
      console.log('[SeasonWalletService] Processing season pass payment...');
      console.log('[SeasonWalletService] User:', userPubkey.substring(0, 8) + '...');
      
      // Validate payment amount
      if (paymentDetails.amount && paymentDetails.amount !== SEASON_1_CONFIG.seasonPassPrice) {
        throw new Error(`Invalid payment amount. Expected ${SEASON_1_CONFIG.seasonPassPrice} sats`);
      }

      // Register the user as a participant
      const registrationResult = await registerForSeason(userPubkey, {
        ...paymentDetails,
        processedAt: new Date().toISOString(),
        walletService: 'seasonWallet',
        seasonId: SEASON_1_CONFIG.id
      });

      if (!registrationResult.success) {
        throw new Error(registrationResult.error);
      }

      console.log('[SeasonWalletService] Season pass payment processed successfully');
      
      // Update balance after successful payment
      await this.updateBalance();

      return {
        success: true,
        participant: registrationResult.participant,
        totalParticipants: registrationResult.totalParticipants,
        paymentDetails
      };

    } catch (error) {
      console.error('[SeasonWalletService] Payment processing failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Get season pass pricing information
   * @returns {object} Pricing details
   */
  getSeasonPassInfo() {
    return {
      seasonId: SEASON_1_CONFIG.id,
      seasonName: SEASON_1_CONFIG.name,
      description: SEASON_1_CONFIG.description,
      price: SEASON_1_CONFIG.seasonPassPrice,
      priceFormatted: `${(SEASON_1_CONFIG.seasonPassPrice / 1000).toFixed(0)}k sats`,
      startDate: SEASON_1_CONFIG.startDate,
      endDate: SEASON_1_CONFIG.endDate,
      rules: SEASON_1_CONFIG.rules
    };
  }

  /**
   * Reconnect the wallet if connection is lost
   */
  async reconnect() {
    console.log('[SeasonWalletService] Attempting to reconnect...');
    this.walletConnected = false;
    this.connectionError = null;
    return await this.initialize();
  }

  /**
   * Get revenue statistics (placeholder for admin use)
   * @returns {object} Revenue information
   */
  getRevenueStats() {
    // This would typically require actual transaction tracking
    // For now, return basic calculated stats
    return {
      estimatedRevenue: 'Check wallet balance directly',
      pricePerPass: SEASON_1_CONFIG.seasonPassPrice,
      currency: 'sats',
      walletAddress: 'RUNSTR@coinos.io'
    };
  }
}

// Create singleton instance
const seasonWalletService = new SeasonWalletService();

// Export both the class and instance
export { SeasonWalletService };
export default seasonWalletService; 