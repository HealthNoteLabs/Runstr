import { useState } from 'react';
import PropTypes from 'prop-types';
import { wavlakeApi } from '../services/wavlakeApi';
import '../assets/styles/TipArtist.css';

export function TipArtistButton({ track, wallet, customAmounts = [1000, 5000, 21000] }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAmountSelector, setShowAmountSelector] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  const handleTipClick = () => {
    // Reset states
    setError(null);
    setSuccessMessage(null);
    
    // Show amount selector
    setShowAmountSelector(true);
  };
  
  const handleAmountSelect = async (amount) => {
    try {
      setIsProcessing(true);
      setError(null);
      setSuccessMessage(null);
      
      // Hide amount selector
      setShowAmountSelector(false);
      
      // Check if we have a wallet
      if (!wallet) {
        throw new Error('Lightning wallet not connected');
      }
      
      // Check if we have a valid track
      if (!track || !track.id) {
        throw new Error('No track selected');
      }
      
      // Get LNURL for the track
      const lnurlData = await wavlakeApi.getLnurlForContent(track.id);
      
      // Process the payment
      const paymentResult = await wavlakeApi.processLnurlPayment(
        lnurlData.lnurl,
        wallet,
        amount
      );
      
      // Show success message
      setSuccessMessage(`Successfully tipped ${paymentResult.amount} sats to ${track.artist}!`);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (error) {
      console.error('Error tipping artist:', error);
      setError(error.message || 'Failed to send tip');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCancel = () => {
    setShowAmountSelector(false);
  };
  
  return (
    <div className="tip-artist-container">
      <button 
        className="tip-artist-button" 
        onClick={handleTipClick}
        disabled={isProcessing || !track || !wallet}
      >
        {isProcessing ? 'Processing...' : '⚡ Tip Artist'}
      </button>
      
      {showAmountSelector && (
        <div className="amount-selector">
          <div className="amount-selector-header">
            <h3>Tip {track?.artist}</h3>
            <button className="close-button" onClick={handleCancel}>×</button>
          </div>
          <div className="amount-buttons">
            {customAmounts.map((amount) => (
              <button 
                key={amount} 
                className="amount-button" 
                onClick={() => handleAmountSelect(amount)}
              >
                {amount} sats
              </button>
            ))}
          </div>
          <div className="custom-amount">
            <input 
              type="number" 
              placeholder="Custom amount (sats)" 
              min="1"
              className="custom-amount-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const amount = parseInt(e.target.value, 10);
                  if (amount > 0) {
                    handleAmountSelect(amount);
                  }
                }
              }}
            />
            <button 
              className="custom-amount-button"
              onClick={(e) => {
                const input = e.target.previousSibling;
                const amount = parseInt(input.value, 10);
                if (amount > 0) {
                  handleAmountSelect(amount);
                }
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
    </div>
  );
}

TipArtistButton.propTypes = {
  track: PropTypes.shape({
    id: PropTypes.string.isRequired,
    artist: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired
  }),
  wallet: PropTypes.object,
  customAmounts: PropTypes.arrayOf(PropTypes.number)
}; 