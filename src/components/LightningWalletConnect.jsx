import { useState } from 'react';
import PropTypes from 'prop-types';
import { NWCWallet } from '../services/nwcWallet';
import '../assets/styles/LightningWalletConnect.css';

export function LightningWalletConnect({ onWalletConnected }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionString, setConnectionString] = useState('');
  const [error, setError] = useState(null);
  const [showInputForm, setShowInputForm] = useState(false);
  
  const handleConnectClick = () => {
    setShowInputForm(true);
    setError(null);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!connectionString.trim()) {
      setError('Please enter a valid connection string');
      return;
    }
    
    try {
      setIsConnecting(true);
      setError(null);
      
      // Create and connect a new wallet instance
      const wallet = new NWCWallet();
      await wallet.connect(connectionString);
      
      // Call the callback with the connected wallet
      if (onWalletConnected) {
        onWalletConnected(wallet);
      }
      
      // Reset state and hide form
      setConnectionString('');
      setShowInputForm(false);
    } catch (error) {
      console.error('Wallet connection error:', error);
      setError(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };
  
  const handleCancel = () => {
    setShowInputForm(false);
    setConnectionString('');
    setError(null);
  };
  
  return (
    <div className="lightning-wallet-connect">
      {!showInputForm ? (
        <button 
          className="connect-wallet-button" 
          onClick={handleConnectClick}
          disabled={isConnecting}
        >
          ⚡ Connect Lightning Wallet
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="wallet-connect-form">
          <div className="form-header">
            <h3>Connect Lightning Wallet</h3>
            <button type="button" className="close-button" onClick={handleCancel}>×</button>
          </div>
          
          <div className="form-group">
            <label htmlFor="connection-string">Nostr Wallet Connect URL:</label>
            <input
              id="connection-string"
              type="text"
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              placeholder="nostr+walletconnect://..."
              className="connection-input"
              required
            />
            <p className="help-text">
              Enter your NWC (Nostr Wallet Connect) URL from a compatible wallet like Alby.
            </p>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-button" 
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="submit-button" 
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

LightningWalletConnect.propTypes = {
  onWalletConnected: PropTypes.func
}; 