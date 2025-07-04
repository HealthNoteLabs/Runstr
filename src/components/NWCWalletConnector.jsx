import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { NostrContext } from '../contexts/NostrContext';
import { 
  connectWallet, 
  softDisconnectWallet, 
  checkWalletConnection as checkWalletConnectionService,
  getWalletAPI,
  subscribeToConnectionChanges,
  CONNECTION_STATES
} from '../services/wallet/WalletPersistenceService';

export const NWCWalletConnector = () => {
  const { setWallet } = useAuth();
  const { defaultZapAmount, updateDefaultZapAmount } = useContext(NostrContext);
  const [nwcUrl, setNwcUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [zapAmountInput, setZapAmountInput] = useState(defaultZapAmount.toString());
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [donationStatus, setDonationStatus] = useState({ message: '', isError: false });
  const connectionCheckInterval = useRef(null);

  // RUNSTR Lightning address
  const RUNSTR_LIGHTNING = 'runstr@geyser.fund';

  // Function for reconnection - defined before it's used
  const reconnectWallet = useCallback(async () => {
    try {
      // Use the persistence service API
      const walletAPI = getWalletAPI();
      const connected = await walletAPI.ensureConnected();
      
      if (connected) {
        // Update auth context with the wallet API
        setWallet({
          provider: walletAPI,
          isEnabled: () => true,
          makePayment: async (invoice) => {
            return await walletAPI.makePayment(invoice);
          },
          sendPayment: async (invoice) => {
            return await walletAPI.makePayment(invoice);
          },
          getBalance: async () => {
            return await walletAPI.getBalance();
          },
          generateZapInvoice: async (pubkey, amount, content) => {
            return await walletAPI.generateZapInvoice(pubkey, amount, content);
          },
          checkConnection: async () => {
            return await walletAPI.checkConnection();
          }
        });
        
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
      
      return connected;
    } catch (err) {
      console.error('[NWCWalletConnector] Failed to reconnect wallet:', err);
      setIsConnected(false);
      return false;
    }
  }, [setWallet]);

  // Check wallet connection status
  const checkWalletConnection = useCallback(async () => {
    try {
      const connectionActive = await checkWalletConnectionService();
      setIsConnected(connectionActive);
      
      if (!connectionActive) {
        console.log('[NWCWalletConnector] Connection lost, attempting to reconnect...');
        await reconnectWallet();
      }
      
      return connectionActive;
    } catch (err) {
      console.error('[NWCWalletConnector] Error checking wallet connection:', err);
      setIsConnected(false);
      return false;
    }
  }, [reconnectWallet]);

  // Setup initial state on mount
  useEffect(() => {
    // Subscribe to connection changes from the persistence service
    const unsubscribe = subscribeToConnectionChanges((state) => {
      setIsConnected(state === CONNECTION_STATES.CONNECTED);
      
      // When connection is established, update auth context with wallet API
      if (state === CONNECTION_STATES.CONNECTED) {
        const walletAPI = getWalletAPI();
        setWallet({
          provider: walletAPI,
          isEnabled: () => true,
          makePayment: async (invoice) => {
            return await walletAPI.makePayment(invoice);
          },
          sendPayment: async (invoice) => {
            return await walletAPI.makePayment(invoice);
          },
          getBalance: async () => {
            return await walletAPI.getBalance();
          },
          generateZapInvoice: async (pubkey, amount, content) => {
            return await walletAPI.generateZapInvoice(pubkey, amount, content);
          },
          checkConnection: async () => {
            return await walletAPI.checkConnection();
          }
        });
      } else if (state === CONNECTION_STATES.DISCONNECTED) {
        // If we're disconnected in the service but the UI shows connected,
        // try to reconnect
        if (isConnected) {
          reconnectWallet();
        }
      }
    });
    
    // Setup check interval for UI purposes
    connectionCheckInterval.current = setInterval(() => {
      checkWalletConnection();
    }, 60000); // Check every minute
    
    return () => {
      unsubscribe();
      if (connectionCheckInterval.current) {
        clearInterval(connectionCheckInterval.current);
        connectionCheckInterval.current = null;
      }
    };
  }, [checkWalletConnection, reconnectWallet, setWallet, isConnected]);

  // Update zapAmountInput when defaultZapAmount changes
  useEffect(() => {
    setZapAmountInput(defaultZapAmount.toString());
  }, [defaultZapAmount]);

  const handleConnect = useCallback(() => {
    if (!nwcUrl.trim()) return;
    
    setConnecting(true);
    setConnectionError('');
    
    connectWallet(nwcUrl.trim())
      .then(connected => {
        if (connected) {
          // Connection is now managed by the persistence service
          // The auth context will be updated via the subscription
          console.log('[NWCWalletConnector] Wallet connected successfully');
        } else {
          setConnectionError('Failed to connect wallet');
        }
      })
      .catch(err => {
        console.error('[NWCWalletConnector] Connection error:', err);
        setConnectionError(err.message || 'Failed to connect wallet');
      })
      .finally(() => {
        setConnecting(false);
      });
  }, [nwcUrl]);

  const handleAuthUrlConnect = useCallback(async () => {
    try {
      const authUrl = prompt("Enter wallet authorization URL", "https://");
      if (authUrl && authUrl.startsWith('https://')) {
        setNwcUrl(authUrl);
        
        setConnecting(true);
        setConnectionError('');
        
        try {
          const connected = await connectWallet(authUrl);
          if (!connected) {
            setConnectionError('Failed to connect with authorization URL');
          }
        } catch (err) {
          console.error('[NWCWalletConnector] Auth URL connection error:', err);
          setConnectionError(err.message || 'Failed to connect with authorization URL');
        } finally {
          setConnecting(false);
        }
      } else if (authUrl) {
        setConnectionError("Invalid authorization URL. Must start with https://");
      }
    } catch (err) {
      console.error("[NWCWalletConnector] Error with auth URL connection:", err);
      setConnectionError(err.message || "Failed to connect with authorization URL");
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      // Use softDisconnectWallet to retain credentials in localStorage
      await softDisconnectWallet();
      
      // Update auth context wallet state
      setWallet(null);
      
      // Update UI
      setIsConnected(false);
      setNwcUrl('');
      
      console.log('[NWCWalletConnector] Wallet disconnected visually (credentials retained)');
    } catch (err) {
      console.error('[NWCWalletConnector] Error disconnecting wallet:', err);
    }
  }, [setWallet]);

  const handleUpdateZapAmount = () => {
    if (zapAmountInput && parseInt(zapAmountInput, 10) > 0) {
      updateDefaultZapAmount(parseInt(zapAmountInput, 10));
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    }
  };

  const handleDonate = async (lightning, name) => {
    const walletAPI = getWalletAPI();
    
    if (!walletAPI) {
      setDonationStatus({ 
        message: 'Wallet not connected. Please connect your wallet first.', 
        isError: true 
      });
      setTimeout(() => {
        setDonationStatus({ message: '', isError: false });
      }, 5000);
      return;
    }

    try {
      // Check connection before attempting donation
      const isConnected = await walletAPI.checkConnection();
      if (!isConnected) {
        const reconnected = await walletAPI.ensureConnected();
        if (!reconnected) {
          throw new Error('Wallet connection is not active. Please reconnect.');
        }
      }
      
      setDonationStatus({ message: `Sending ${defaultZapAmount} sats to ${name}...`, isError: false });

      // Parse the Lightning address and create the payment URL
      let lnurlEndpoint;
      if (lightning.includes('@')) {
        // Handle Lightning address (lud16)
        const [username, domain] = lightning.split('@');
        lnurlEndpoint = `https://${domain}/.well-known/lnurlp/${username}`;
      } else {
        // In case a raw LNURL is provided
        lnurlEndpoint = lightning;
      }

      // First get the LNURL-pay metadata
      const response = await fetch(lnurlEndpoint);
      
      // Check for empty response
      if (!response.ok) {
        throw new Error(`Payment endpoint error: ${response.status} ${response.statusText}`);
      }
      
      let lnurlPayData;
      try {
        lnurlPayData = await response.json();
        console.log('[DonationFlow] Received LNURL-pay metadata:', lnurlPayData);
      } catch (error) {
        console.error('[DonationFlow] Failed to parse LNURL-pay metadata:', error);
        throw new Error('Invalid response from payment endpoint. Please try again.');
      }

      if (!lnurlPayData.callback) {
        console.error('[DonationFlow] Invalid LNURL-pay response - missing callback URL:', lnurlPayData);
        throw new Error('Invalid LNURL-pay response: missing callback URL');
      }

      // Amount in millisatoshis (convert sats to millisats)
      const amount = defaultZapAmount * 1000;

      // Check if amount is within min/max bounds
      if (
        amount < lnurlPayData.minSendable ||
        amount > lnurlPayData.maxSendable
      ) {
        throw new Error(
          `Amount must be between ${lnurlPayData.minSendable / 1000} and ${lnurlPayData.maxSendable / 1000} sats`
        );
      }

      // Construct the callback URL with amount
      const callbackUrl = new URL(lnurlPayData.callback);
      callbackUrl.searchParams.append('amount', amount);
      
      // Add comment for the donation
      if (lnurlPayData.commentAllowed && lnurlPayData.commentAllowed > 0) {
        const comment = `Donation to ${name} from RUNSTR app! ⚡️`;
        callbackUrl.searchParams.append('comment', comment);
      }

      // Add lnurl parameter if needed (required for NIP-57 compatibility)
      if (lightning.includes('@')) {
        // If we have a lightning address, add it as lnurl parameter
        callbackUrl.searchParams.append('lnurl', lightning);
      }

      // Log the callback URL for debugging
      const callbackUrlString = callbackUrl.toString();
      console.log('[DonationFlow] Callback URL:', 
        callbackUrlString.substring(0, Math.min(100, callbackUrlString.length)) + 
        (callbackUrlString.length > 100 ? '...' : '')
      );

      // Get the invoice with timeout and error handling
      let invoiceResponse;
      try {
        // Add timeout to fetch call to avoid hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        invoiceResponse = await fetch(callbackUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!invoiceResponse.ok) {
          throw new Error(`Invoice request failed: ${invoiceResponse.status} ${invoiceResponse.statusText}`);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          throw new Error('Invoice request timed out. Please try again.');
        }
        throw err;
      }
      
      // Parse invoice data with error handling
      let invoiceData;
      try {
        invoiceData = await invoiceResponse.json();
        console.log('[DonationFlow] Received invoice data:', invoiceData);
      } catch (error) {
        console.error('[DonationFlow] Failed to parse invoice response:', error);
        throw new Error('Failed to parse invoice response. Please try again.');
      }

      if (!invoiceData.pr) {
        console.error('[DonationFlow] Invalid LNURL-pay response - missing payment request:', invoiceData);
        throw new Error('Invalid LNURL-pay response: missing payment request');
      }

      // Pay using the wallet
      await walletAPI.makePayment(invoiceData.pr);

      setDonationStatus({ message: `Successfully donated ${defaultZapAmount} sats to ${name}! ⚡️`, isError: false });
      setTimeout(() => {
        setDonationStatus({ message: '', isError: false });
      }, 5000);
    } catch (err) {
      console.error(`Error donating to ${name}:`, err);
      setDonationStatus({ message: `Failed to donate: ${err.message}`, isError: true });
      setTimeout(() => {
        setDonationStatus({ message: '', isError: false });
      }, 5000);
    }
  };

  return (
    <div className="nwc-wallet-connector">
      {/* Connection Card */}
      <div className="wallet-option nwc-connection-card">
        <h3>Connect your Lightning Wallet with NWC</h3>
        
        {!isConnected ? (
          <>
            <p className="helper-text">
              Enter your Nostr Wallet Connect URL
            </p>
            <div className="input-with-button">
              <input
                type="text"
                value={nwcUrl}
                onChange={(e) => setNwcUrl(e.target.value)}
                placeholder="nostr+walletconnect://..."
                className="nwc-input"
              />
              <button 
                onClick={handleConnect} 
                disabled={connecting || !nwcUrl.trim()}
                className="connect-button"
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
            
            <div className="auth-url-section">
              <button
                onClick={handleAuthUrlConnect}
                disabled={connecting}
                className="auth-url-button"
              >
                Connect with Authorization URL
              </button>
              <p className="helper-text small">
                Use this if you have an authorization URL from your wallet app
              </p>
            </div>
            
            {connectionError && (
              <p className="error-message">{connectionError}</p>
            )}
          </>
        ) : (
          <div className="connected-state">
            <p className="success-message">Wallet connected successfully! ⚡️</p>
            <button 
              onClick={checkWalletConnection} 
              className="check-connection-button"
            >
              Check Connection
            </button>
            <button 
              onClick={handleDisconnect} 
              className="disconnect-button"
            >
              Disconnect Wallet
            </button>
          </div>
        )}
      </div>

      {/* Zap Settings Card */}
      <div className="wallet-option nwc-settings-card">
        <h3>Default Zap Settings</h3>
        <div className="zap-amount-setting">
          <label htmlFor="defaultZapAmount">Default Zap Amount (sats):</label>
          <div className="input-with-button">
            <input
              id="defaultZapAmount"
              type="number"
              min="1"
              value={zapAmountInput}
              onChange={(e) => setZapAmountInput(e.target.value)}
              placeholder="Default zap amount in sats"
            />
            <button 
              onClick={handleUpdateZapAmount} 
              disabled={!zapAmountInput || parseInt(zapAmountInput, 10) <= 0}
              className="save-button"
            >
              Save
            </button>
          </div>
          {showSuccessMessage && (
            <div className="success-message">Default zap amount updated successfully!</div>
          )}
          <p className="current-setting">Current default: {defaultZapAmount} sats</p>
        </div>
      </div>

      {/* Donation Card */}
      <div className="wallet-option nwc-donation-card">
        <h3>Support RUNSTR</h3>
        <p>Donate to help the project continue building awesome software!</p>
        
        <div className="donation-buttons">
          <button 
            className="donate-button runstr" 
            onClick={() => handleDonate(RUNSTR_LIGHTNING, 'RUNSTR')}
            disabled={!isConnected}
          >
            ⚡️ Zap RUNSTR ({defaultZapAmount} sats)
          </button>
        </div>
        
        {donationStatus.message && (
          <div className={`donation-status ${donationStatus.isError ? 'error' : 'success'}`}>
            {donationStatus.message}
          </div>
        )}
        
        <p className="donation-note">
          Your donations help fund development of free and open source software.
        </p>
      </div>
    </div>
  );
}; 