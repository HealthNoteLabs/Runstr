import { LN, nwc } from '@getalby/sdk';
import { Platform } from '../utils/react-native-shim';
import AmberAuth from '../services/AmberAuth';

/**
 * AlbyWallet class provides a complete wallet implementation using
 * the Alby SDK for NWC functionality
 */
export class AlbyWallet {
  constructor() {
    this.client = null;
    this.lnClient = null;
    this.nwcClient = null;
    this.isConnected = false;
    this.connectionString = null;
    this.connectionCheckInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.lastConnectionCheck = 0;
    this.authUrl = null;
  }

  /**
   * Connect to a wallet using NWC URL
   * @param {string} url - NWC connection URL or authorization URL
   * @returns {Promise<boolean>} - Connection success status
   */
  async connect(url) {
    try {
      console.log('Connecting to wallet with URL:', url.substring(0, 20) + '...');

      // Clean up any existing connection
      this.disconnect();

      if (url.startsWith('nostr+walletconnect://')) {
        // Direct NWC connection string
        console.log('[AlbyWallet] Connecting with direct NWC connection string...');
        this.connectionString = url;
        localStorage.setItem('nwcConnectionString', url);
        
        // Create both clients
        console.log('[AlbyWallet] Creating NWC and LN clients...');
        this.nwcClient = new nwc.NWCClient({ nostrWalletConnectUrl: url });
        this.lnClient = new LN(url);
        console.log('[AlbyWallet] Clients created successfully');
      }
      else if (url.startsWith('https://')) {
        // Authorization URL
        console.log('[AlbyWallet] Connecting with authorization URL...');
        this.authUrl = url;
        localStorage.setItem('nwcAuthUrl', url);
        
        try {
          // Create NWC client from authorization URL
          console.log('[AlbyWallet] Creating NWC client from authorization URL...');
          this.nwcClient = await nwc.NWCClient.fromAuthorizationUrl(url, {
            name: "RUNSTR App " + Date.now(),
          });
          
          // Store the connection and create LN client
          const nwcUrl = this.nwcClient.getNostrWalletConnectUrl();
          console.log('[AlbyWallet] Got NWC URL from authorization:', nwcUrl?.substring(0, 50) + '...');
          this.connectionString = nwcUrl;
          localStorage.setItem('nwcConnectionString', nwcUrl);
          this.lnClient = new LN(nwcUrl);
          console.log('[AlbyWallet] Authorization connection completed');
        } catch (error) {
          console.error('Failed to connect via authorization URL:', error);
          throw new Error(`Authorization URL connection failed: ${error.message || 'Unknown error'}`);
        }
      }
      else {
        throw new Error('Invalid connection format. Must start with nostr+walletconnect:// or https://');
      }

      // Test the connection
      try {
        await this.getInfo();
      } catch (error) {
        console.error('Connection test failed:', error);
        throw new Error(`Wallet connection test failed: ${error.message || 'Unknown error'}`);
      }
      
      this.isConnected = true;
      this.lastConnectionCheck = Date.now();
      
      // Set up connection monitoring
      this.startConnectionMonitoring();
      
      return true;
    } catch (error) {
      console.error('Wallet connection error:', error);
      this.isConnected = false;
      
      // Clean up partial connections
      this.nwcClient = null;
      this.lnClient = null;
      
      throw error;
    }
  }

  /**
   * Start periodic connection monitoring
   */
  startConnectionMonitoring() {
    // Clear any existing interval
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    // Check connection every 2 minutes
    this.connectionCheckInterval = setInterval(async () => {
      const isConnected = await this.checkConnection();
      
      // If not connected, try to reconnect
      if (!isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Connection lost. Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        await this.ensureConnected();
      } else if (!isConnected) {
        console.log('Max reconnection attempts reached. Please reconnect manually.');
        clearInterval(this.connectionCheckInterval);
        this.connectionCheckInterval = null;
      } else {
        // Reset reconnect attempts on successful connection
        this.reconnectAttempts = 0;
      }
    }, 120000); // 2 minutes
  }

  /**
   * Check if the wallet connection is alive
   * @returns {Promise<boolean>} - Connection status
   */
  async checkConnection() {
    // Throttle checks to prevent too many requests
    const now = Date.now();
    if (now - this.lastConnectionCheck < 30000) {
      return this.isConnected;
    }
    
    this.lastConnectionCheck = now;
    
    try {
      if (!this.nwcClient || !this.lnClient) {
        this.isConnected = false;
        return false;
      }
      
      // Try to get wallet info to verify connection
      await this.getInfo();
      this.isConnected = true;
      return true;
    } catch (error) {
      console.warn('Wallet connection check failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Ensure the wallet is connected, attempting to reconnect if needed
   * @returns {Promise<boolean>} - Connection status
   */
  async ensureConnected() {
    // First check current connection status
    if (await this.checkConnection()) {
      console.log('[AlbyWallet] Connection check passed, wallet is connected');
      return true;
    }
    
    console.log('[AlbyWallet] Connection check failed, attempting to reconnect...');
    
    // Try to reconnect using saved credentials
    try {
      // Try each reconnection method in sequence, with multiple attempts
      for (let attempt = 0; attempt < 3; attempt++) {
        console.log(`[AlbyWallet] Reconnection attempt ${attempt + 1}/3`);
        
        // Try to reconnect using authUrl first, as it's the most reliable method
        if (this.authUrl) {
          console.log('[AlbyWallet] Attempting reconnection using existing authUrl');
          const connected = await this.connect(this.authUrl);
          if (connected) return true;
        }
        
        const savedAuthUrl = localStorage.getItem('nwcAuthUrl');
        if (savedAuthUrl) {
          console.log('[AlbyWallet] Attempting reconnection using saved authUrl');
          const connected = await this.connect(savedAuthUrl);
          if (connected) return true;
        }
        
        // Fall back to connection string if auth URL is not available
        if (this.connectionString) {
          console.log('[AlbyWallet] Attempting reconnection using existing connectionString');
          const connected = await this.connect(this.connectionString);
          if (connected) return true;
        }
        
        const savedConnectionString = localStorage.getItem('nwcConnectionString');
        if (savedConnectionString) {
          console.log('[AlbyWallet] Attempting reconnection using saved connectionString');
          const connected = await this.connect(savedConnectionString);
          if (connected) return true;
        }
        
        // Wait briefly before next attempt
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.error('[AlbyWallet] All reconnection attempts failed');
      return false;
    } catch (error) {
      console.error('[AlbyWallet] Failed to reconnect wallet:', error);
      return false;
    }
  }

  /**
   * Get information about the wallet
   * @returns {Promise<Object>} - Wallet information
   */
  async getInfo() {
    try {
      console.log('[AlbyWallet] Starting getInfo()...');
      
      if (!this.nwcClient) {
        console.error('[AlbyWallet] No NWC client available for getInfo');
        throw new Error('Wallet not initialized');
      }
      
      console.log('[AlbyWallet] NWC client exists, calling getInfo()...');
      
      // Some implementations don't support getInfo, so we handle that case
      try {
        const info = await this.nwcClient.getInfo();
        console.log('[AlbyWallet] Wallet info retrieved successfully:', info);
        return info;
      } catch (error) {
        // If getInfo failed, try to use getBalance as an alternative way to check connection
        console.warn('[AlbyWallet] getInfo failed, trying getBalance instead:', error);
        const balance = await this.nwcClient.getBalance();
        
        // If we get here, the connection is working even though getInfo failed
        console.log('[AlbyWallet] Connection confirmed via getBalance, balance result:', balance);
        return { 
          fallback: true, 
          message: 'This wallet implementation does not support getInfo, but connection is confirmed',
          balance: balance
        };
      }
    } catch (error) {
      console.error('[AlbyWallet] Get wallet info error:', error);
      throw error;
    }
  }

  /**
   * Get the wallet balance
   * @returns {Promise<number>} - Balance in sats
   */
  async getBalance() {
    try {
      console.log('[AlbyWallet] Starting getBalance()...');
      
      if (!await this.ensureConnected()) {
        throw new Error('Wallet not connected');
      }
      
      console.log('[AlbyWallet] Wallet connected, calling nwcClient.getBalance()...');
      const response = await this.nwcClient.getBalance();
      
      console.log('[AlbyWallet] Raw getBalance response:', {
        response,
        type: typeof response,
        isObject: typeof response === 'object',
        isNull: response === null,
        keys: response && typeof response === 'object' ? Object.keys(response) : 'N/A'
      });
      
      // Handle different response formats and convert msats to sats if needed
      let balance = 0;
      
      if (typeof response === 'object' && response !== null) {
        // If balance is in msats (NWC standard), convert to sats
        const rawBalance = response.balance || response.amount || response.value || 0;
        balance = Math.floor(rawBalance / 1000);
        console.log('[AlbyWallet] Object response - raw:', rawBalance, 'converted to sats:', balance);
      } else if (typeof response === 'number') {
        // Some implementations might return just a number
        // Check if it looks like msats (> 1M suggests msats)
        if (response > 1000000) {
          balance = Math.floor(response / 1000);
          console.log('[AlbyWallet] Number response (likely msats) - raw:', response, 'converted to sats:', balance);
        } else {
          balance = response;
          console.log('[AlbyWallet] Number response (likely sats) - balance:', balance);
        }
      } else {
        console.log('[AlbyWallet] Unexpected response type, returning 0');
        balance = 0;
      }
      
      console.log('[AlbyWallet] Final balance result:', balance);
      return balance;
    } catch (error) {
      console.error('[AlbyWallet] Get balance error:', error);
      throw new Error(`Failed to get wallet balance: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Make a payment using the connected wallet
   * @param {string} invoice - BOLT11 invoice to pay
   * @returns {Promise<Object>} - Payment result
   */
  async makePayment(invoice) {
    try {
      console.log('[AlbyWallet] Making payment for invoice:', invoice.substring(0, 30) + '...');
      
      if (!await this.ensureConnected()) {
        console.error('[AlbyWallet] Wallet not connected');
        throw new Error('Wallet not connected');
      }

      // Validate invoice
      if (!invoice || typeof invoice !== 'string') {
        console.error('[AlbyWallet] Invalid invoice format');
        throw new Error('Invalid invoice format');
      }

      // Create abort controller for timeout handling
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000);
      
      try {
        // Use the LN client for better payment experience
        console.log('[AlbyWallet] Attempting payment with LN client');
        const response = await this.lnClient.pay(invoice);
        clearTimeout(timeoutId);
        console.log('[AlbyWallet] Payment successful with LN client:', response);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        
        // If LN client fails, fallback to NWC client
        console.error('[AlbyWallet] LN client payment failed:', error);
        
        console.warn('[AlbyWallet] LN client payment failed, using NWC client instead');
        console.log('[AlbyWallet] Attempting payment with NWC client');
        
        try {
          const nwcResponse = await this.nwcClient.payInvoice({ invoice });
          console.log('[AlbyWallet] Payment successful with NWC client:', nwcResponse);
          return nwcResponse;
        } catch (nwcError) {
          console.error('[AlbyWallet] NWC client payment also failed:', nwcError);
          
          // If this is a connection issue, mark connection as broken
          if (nwcError.message && (
              nwcError.message.includes('connection') || 
              nwcError.message.includes('connect') ||
              nwcError.message.includes('timeout')
          )) {
            this.isConnected = false;
          }
          
          throw new Error(`Payment failed: ${nwcError.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('[AlbyWallet] Payment error:', error);
      throw error;
    }
  }

  /**
   * Generate an invoice for receiving payments
   * @param {number} amount - Amount in sats
   * @param {string} memo - Optional description for the invoice
   * @returns {Promise<string>} - BOLT11 invoice
   */
  async generateInvoice(amount, memo = '') {
    try {
      if (!await this.ensureConnected()) {
        throw new Error('Wallet not connected');
      }

      // Ensure amount is a valid number
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Amount must be a positive number');
      }

      // Convert sats to msats for NWC API
      const amountMsats = amount * 1000;
      
      // Create abort controller for timeout handling
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000);
      
      try {
        const response = await this.nwcClient.makeInvoice({
          amount: amountMsats,
          memo: memo || `Invoice for ${amount} sats`
        });
        
        clearTimeout(timeoutId);
        
        // Return the invoice string depending on the response format
        return response.paymentRequest || response.invoice || response;
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new Error('Invoice generation timed out. Please try again.');
        }
        
        console.error('[AlbyWallet] Invoice generation error:', error);
        throw new Error(`Failed to generate invoice: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[AlbyWallet] Generate invoice error:', error);
      throw error;
    }
  }

  /**
   * Generate a zap invoice for the specified pubkey
   * @param {string} pubkey - Target pubkey to zap
   * @param {number} amount - Amount in sats
   * @param {string} content - Optional content for the zap
   * @returns {Promise<string>} - BOLT11 invoice
   */
  async generateZapInvoice(pubkey, amount, content = '') {
    try {
      console.log(`[AlbyWallet] Generating zap invoice for ${pubkey.substring(0, 8)}... (${amount} sats)`);
      
      if (!await this.ensureConnected()) {
        console.error('[AlbyWallet] Wallet not connected');
        throw new Error('Wallet not connected');
      }

      if (!pubkey) {
        console.error('[AlbyWallet] Pubkey is required for zap invoice');
        throw new Error('Pubkey is required for zap invoice');
      }

      // Create zap request event as a plain object instead of using NostrEvent
      const zapRequest = {
        kind: 9734,
        content: content || '',
        tags: [
          ['p', pubkey],
          ['amount', (amount * 1000).toString()], // Convert to millisats per NIP-57
          ['relays', 'wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band'], // NIP-57 format
          // Individual relay entries for maximum compatibility
          ['r', 'wss://relay.damus.io'],
          ['r', 'wss://nos.lol'],
          ['r', 'wss://relay.nostr.band']
        ],
        created_at: Math.floor(Date.now() / 1000)
      };

      console.log('[AlbyWallet] Created zap request:', JSON.stringify(zapRequest));

      // Sign the zap request using the appropriate method based on platform
      let encodedZapRequest;
      
      // For Android, use Amber if available
      if (Platform.OS === 'android') {
        try {
          console.log('[AlbyWallet] Checking for Amber availability on Android');
          const isAmberAvailable = await AmberAuth.isAmberInstalled();
          
          if (isAmberAvailable) {
            console.log('[AlbyWallet] Signing zap request with Amber');
            try {
              // Get user's public key first if needed
              const userPubkey = localStorage.getItem('userPublicKey') || await AmberAuth.getPublicKey();
              zapRequest.pubkey = userPubkey;
              
              // Sign the zap request with Amber
              const signedZapRequest = await AmberAuth.signEvent(zapRequest);
              console.log('[AlbyWallet] Zap request signed with Amber successfully');
              
              encodedZapRequest = btoa(JSON.stringify(signedZapRequest));
              console.log('[AlbyWallet] Encoded zap request (length):', encodedZapRequest.length);
            } catch (amberSignError) {
              console.error('[AlbyWallet] Amber signing failed:', amberSignError);
              throw new Error(`Failed to sign zap request with Amber: ${amberSignError.message || 'Unknown error'}`);
            }
          } else {
            console.log('[AlbyWallet] Amber not available, checking for window.nostr');
          }
        } catch (amberError) {
          console.error('[AlbyWallet] Error with Amber integration:', amberError);
          // Continue to window.nostr fallback
        }
      }
      
      // Web fallback: try window.nostr if available
      if (window.nostr) {
        // No need to call toObject() since it's already a plain object
        console.log('[AlbyWallet] Signing zap request with window.nostr');
        try {
          const signedZapRequest = await window.nostr.signEvent(zapRequest);
          console.log('[AlbyWallet] Signed zap request:', JSON.stringify(signedZapRequest));
          encodedZapRequest = btoa(JSON.stringify(signedZapRequest));
          console.log('[AlbyWallet] Encoded zap request (length):', encodedZapRequest.length);
        } catch (signError) {
          console.error('[AlbyWallet] Error signing zap request:', signError);
          throw new Error(`Failed to sign zap request: ${signError.message || 'Unknown error'}`);
        }
      } else {
        // Handle case where no signer is available (fallback)
        console.error('[AlbyWallet] No signer available (neither Amber nor window.nostr)');
        const regularInvoice = await this.generateInvoice(amount, `Payment for ${pubkey.substring(0, 8)}...`);
        return regularInvoice;
      }

      // Rest of the method remains the same (invoice generation)
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000);
      
      try {
        // Try standard format first
        console.log('[AlbyWallet] Making invoice with standard format');
        const response = await this.nwcClient.makeInvoice({
          amount: amount * 1000, // Convert to msats
          memo: `Zap for ${pubkey.substring(0, 8)}...`,
          zapRequest: encodedZapRequest
        });
        
        clearTimeout(timeoutId);
        console.log('[AlbyWallet] Invoice created successfully (standard format):', response);
        return response.paymentRequest || response.invoice || response;
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Check for HTTP 422 errors, which often indicate permission issues with NWC
        if (error.message && error.message.includes('422')) {
          console.error('[AlbyWallet] HTTP 422 error - This often means your wallet service doesn\'t support zaps or has incorrect permissions:', error);
          
          // Some NWC services return 422 for ZapRequest but might support regular invoices
          try {
            console.log('[AlbyWallet] Trying to generate a regular invoice as fallback');
            const regularInvoice = await this.generateInvoice(amount, `Zap for ${pubkey.substring(0, 8)}...`);
            console.log('[AlbyWallet] Regular invoice created as fallback:', regularInvoice);
            return regularInvoice;
          } catch (regularInvoiceError) {
            console.error('[AlbyWallet] Failed to generate regular invoice:', regularInvoiceError);
            // Continue to other fallbacks
          }
        }
        
        // Try alternative format if the first attempt fails
        console.error('[AlbyWallet] First zap invoice attempt failed:', error);
        
        // Try alternative format with zap_request
        try {
          console.log('[AlbyWallet] Trying alternative format with zap_request');
          const altResponse = await this.nwcClient.makeInvoice({
            amount: amount * 1000,
            description: `Zap for ${pubkey.substring(0, 8)}...`,
            zap_request: encodedZapRequest
          });
          
          console.log('[AlbyWallet] Invoice created successfully (alternative format):', altResponse);
          return altResponse.paymentRequest || altResponse.invoice || altResponse;
        } catch (altError) {
          console.error('[AlbyWallet] Alternative format failed:', altError);
          
          // Last resort: generate a regular invoice without zap request
          console.log('[AlbyWallet] Trying basic invoice format (without zap request)');
          try {
            const basicResponse = await this.nwcClient.makeInvoice({
              amount: amount * 1000,
              memo: `Zap for ${pubkey.substring(0, 8)}...`
            });
            
            console.log('[AlbyWallet] Invoice created successfully (basic format):', basicResponse);
            return basicResponse.paymentRequest || basicResponse.invoice || basicResponse;
          } catch (basicError) {
            console.error('[AlbyWallet] All invoice formats failed:', basicError);
            throw new Error('Failed to generate zap invoice: Wallet may not support zaps');
          }
        }
      }
    } catch (error) {
      console.error('[AlbyWallet] Generate zap invoice error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the wallet
   * @returns {Promise<boolean>} - Disconnect success status
   */
  async disconnect() {
    try {
      // Clear connection monitoring
      if (this.connectionCheckInterval) {
        clearInterval(this.connectionCheckInterval);
        this.connectionCheckInterval = null;
      }
      
      // Clean up client instances
      this.nwcClient = null;
      this.lnClient = null;
      this.isConnected = false;
      this.connectionString = null;
      this.authUrl = null;
      this.reconnectAttempts = 0;
      
      // Clear stored connection info
      localStorage.removeItem('nwcAuthUrl');
      localStorage.removeItem('nwcConnectionString');
      
      return true;
    } catch (error) {
      console.error('[AlbyWallet] Disconnect error:', error);
      throw error;
    }
  }

  /**
   * Get the current connection state
   * @returns {Object} - Connection state information
   */
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      hasNwcClient: !!this.nwcClient,
      hasLnClient: !!this.lnClient,
      lastChecked: this.lastConnectionCheck,
      reconnectAttempts: this.reconnectAttempts,
      hasAuthUrl: !!this.authUrl
    };
  }

  /**
   * Debug method to test wallet capabilities and connection
   * @returns {Promise<Object>} - Debug information
   */
  async debugWallet() {
    const debug = {
      hasNwcClient: !!this.nwcClient,
      hasLnClient: !!this.lnClient,
      isConnected: this.isConnected,
      connectionString: this.connectionString?.substring(0, 50) + '...',
      authUrl: this.authUrl?.substring(0, 50) + '...',
      capabilities: {},
      errors: []
    };

    if (!this.nwcClient) {
      debug.errors.push('No NWC client available');
      return debug;
    }

    // Test getInfo
    try {
      const info = await this.nwcClient.getInfo();
      debug.capabilities.getInfo = { success: true, data: info };
    } catch (error) {
      debug.capabilities.getInfo = { success: false, error: error.message };
    }

    // Test getBalance
    try {
      const balance = await this.nwcClient.getBalance();
      debug.capabilities.getBalance = { success: true, data: balance };
    } catch (error) {
      debug.capabilities.getBalance = { success: false, error: error.message };
    }

    return debug;
  }
} 