import { useEffect, useState, useContext } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { Button, init, onConnected } from '@getalby/bitcoin-connect-react';
import { NostrContext } from '../contexts/NostrContext';

// Initialize Bitcoin Connect
init({
  appName: 'Nostr Run Club'
});

// RUNSTR and OpenSats Lightning addresses
const RUNSTR_LIGHTNING = 'runstr@geyser.fund';

export const WalletConnect = () => {
  const { setWallet } = useAuth();
  const { defaultZapAmount, updateDefaultZapAmount } = useContext(NostrContext);
  const [zapAmountInput, setZapAmountInput] = useState(defaultZapAmount.toString());
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [donationStatus, setDonationStatus] = useState({ message: '', isError: false });

  useEffect(() => {
    // Set up connection event listener for wallet state management
    const unsub = onConnected((provider) => {
      // Create a wallet interface that matches your app's needs
      const bitcoinWallet = {
        provider,
        makePayment: async (invoice) => {
          return await provider.sendPayment(invoice);
        },
        getBalance: async () => {
          return await provider.getBalance();
        }
      };

      setWallet(bitcoinWallet);
    });

    return () => {
      unsub();
    };
  }, [setWallet]);

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

  const handleDonate = async (lightning, name) => {
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

      // Use Bitcoin Connect to get the provider and pay
      const { requestProvider } = await import('@getalby/bitcoin-connect');
      const provider = await requestProvider();
      await provider.sendPayment(invoiceData.pr);

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
          onConnect={(provider) => {
            // The onConnected event handler above will handle the wallet setup
            console.log('Wallet connected through button:', provider);
          }}
        />
        <p className="helper-text">
          Connect using Alby extension or other Bitcoin Connect compatible
          wallets
        </p>
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
