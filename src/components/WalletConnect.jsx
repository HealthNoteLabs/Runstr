import { useEffect, useState, useContext } from 'react';
// import { useAuth } from '../hooks/useAuth.jsx'; // No longer using setWallet from useAuth here
import { Button, init } from '@getalby/bitcoin-connect-react'; // Removed onConnected, will use WalletContext
import { NostrContext } from '../contexts/NostrContext';
import { WalletContext } from './WalletContext'; // Import WalletContext to use its connection logic

// Initialize Bitcoin Connect
init({
  appName: 'Nostr Run Club'
});

// RUNSTR and OpenSats Lightning addresses
const RUNSTR_LIGHTNING = 'runstr@geyser.fund';

export const WalletConnect = () => {
  // const { setWallet } = useAuth(); // No longer using setWallet from useAuth here
  const { connectWithUrl, wallet: walletFromContext, connectionState } = useContext(WalletContext); // Get connectWithUrl from WalletContext
  const { defaultZapAmount, updateDefaultZapAmount } = useContext(NostrContext);
  const [zapAmountInput, setZapAmountInput] = useState(defaultZapAmount.toString());
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [donationStatus, setDonationStatus] = useState({ message: '', isError: false });
  const [isConnectingViaButton, setIsConnectingViaButton] = useState(false);

  // This useEffect is no longer needed as WalletContext and WalletPersistenceService handle connection state
  // useEffect(() => {
  //   // Set up connection event listener for wallet state management
  //   const unsub = onConnected((provider) => {
  //     // Create a wallet interface that matches your app's needs
  //     const bitcoinWallet = {
  //       provider,
  //       makePayment: async (invoice) => {
  //         return await provider.sendPayment(invoice);
  //       },
  //       getBalance: async () => {
  //         return await provider.getBalance();
  //       }
  //     };
  //     // setWallet(bitcoinWallet); // This was the problematic part
  //   });
  //   return () => {
  //     unsub();
  //   };
  // }, [setWallet]);

  // Update zapAmountInput when defaultZapAmount changes
  useEffect(() => {
    setZapAmountInput(defaultZapAmount.toString());
  }, [defaultZapAmount]);

  const handleUpdateZapAmount = () => {
    if (zapAmountInput && parseInt(zapAmountInput, 10) > 0) {
      updateDefaultZapAmount(parseInt(zapAmountInput, 10));
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    }
  };

  const handleBitcoinConnectButton = async (provider) => {
    if (!provider) {
      console.warn('[WalletConnect] Provider not received from Bitcoin Connect button');
      setDonationStatus({ message: 'Connection failed: No provider found.', isError: true });
      return;
    }
    
    console.log('[WalletConnect] Provider received from Bitcoin Connect button:', provider);
    setIsConnectingViaButton(true);
    setDonationStatus({ message: 'Processing connection...', isError: false });

    // Attempt to extract NWC URL or Auth URL if the provider is an NWC provider from Alby SDK
    // This is speculative as the provider from Bitcoin Connect might not be a direct NWCProvider instance
    // or expose the URL easily.
    let nwcUrlToConnect = null;
    if (provider?.config?.nostrWalletConnectUrl) { // Alby NWCProvider specific property
        nwcUrlToConnect = provider.config.nostrWalletConnectUrl;
        console.log('[WalletConnect] Extracted NWC URL from provider:', nwcUrlToConnect);
    } else if (provider?.config?.authUrl) { // Check for authUrl if direct NWC URL is not available
        nwcUrlToConnect = provider.config.authUrl;
        console.log('[WalletConnect] Extracted Auth URL from provider:', nwcUrlToConnect);
    }
    // Add more checks here if other wallet types from Bitcoin Connect expose their NWC/Auth URLs differently

    if (nwcUrlToConnect) {
        try {
            const connected = await connectWithUrl(nwcUrlToConnect);
            if (connected) {
                console.log('[WalletConnect] Successfully connected via WalletContext using extracted URL.');
                setDonationStatus({ message: 'Wallet connected!', isError: false });
            } else {
                console.error('[WalletConnect] WalletContext connectWithUrl failed with extracted URL.');
                setDonationStatus({ message: 'Connection failed. Please try connecting manually via the NWC page if issues persist.', isError: true });
            }
        } catch (error) {
            console.error('[WalletConnect] Error connecting with extracted URL via WalletContext:', error);
            setDonationStatus({ message: `Connection error: ${error.message}. Try NWC page.`, isError: true });
        }
    } else {
        console.warn('[WalletConnect] Could not extract NWC/Auth URL from the Bitcoin Connect provider. The wallet might not be NWC-based or the URL is not exposed. Users may need to connect manually via NWC page.');
        setDonationStatus({ message: 'Could not automatically derive NWC URL. If this is an NWC wallet, try connecting via the NWC page.', isError: true });
        // Potentially, we could fall back to a different handling mechanism if the provider is not NWC
        // For now, we guide to NWC page.
    }
    setIsConnectingViaButton(false);
  };

  const handleDonate = async (lightning, name) => {
    if (!walletFromContext || connectionState !== 'connected') {
      setDonationStatus({ message: 'Please connect your wallet first.', isError: true });
      return;
    }
    try {
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
      const lnurlPayData = await response.json();

      if (!lnurlPayData.callback) {
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

      // Get the invoice
      const invoiceResponse = await fetch(callbackUrl);
      const invoiceData = await invoiceResponse.json();

      if (!invoiceData.pr) {
        throw new Error('Invalid LNURL-pay response: missing payment request');
      }

      // Use wallet from WalletContext to make payment
      await walletFromContext.makePayment(invoiceData.pr);

      setDonationStatus({ message: `Successfully donated ${defaultZapAmount} sats to ${name}! ⚡️`, isError: false });
      setTimeout(() => {
        setDonationStatus({ message: '', isError: false });
      }, 5000);
    } catch (error) {
      console.error(`Error donating to ${name}:`, error);
      setDonationStatus({ message: `Failed to donate: ${error.message}`, isError: true });
      setTimeout(() => {
        setDonationStatus({ message: '', isError: false });
      }, 5000);
    }
  };

  return (
    <div className="wallet-connect">
      <div className="connection-section">
        <h3>Connect your Bitcoin Wallet</h3>
        <Button
          onConnect={handleBitcoinConnectButton} // Use the new handler
        />
        <p className="helper-text">
          Connect using Alby extension or other Bitcoin Connect compatible
          wallets. For NWC string/Auth URL, please use the NWC page.
        </p>
        {isConnectingViaButton && <p>Connecting...</p>}
      </div>

      <div className="zap-settings-section">
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

      <div className="donation-section">
        <h3>Support RUNSTR</h3>
        <p>Donate to help the project continue building awesome software!</p>
        
        <div className="donation-buttons">
          <button 
            className="donate-button runstr" 
            onClick={() => handleDonate(RUNSTR_LIGHTNING, 'RUNSTR')}
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
