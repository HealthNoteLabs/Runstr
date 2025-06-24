import { useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { useWallet } from '../hooks/useWallet';
import { getLnurlForTrack, processWavlakeLnurlPayment } from '../utils/wavlake';
import '../assets/styles/WavlakeZap.css';

/**
 * WavlakeZap Component
 * Handles zapping artists on Wavlake content via LNURL
 * This component is separate from NostrZap to avoid using window.nostr for mobile compatibility
 * 
 * @param {Object} props
 * @param {string} props.trackId - The Wavlake track ID to zap
 * @param {number} [props.amount=100] - Amount in sats to zap (default: 100)
 * @param {string} [props.buttonText="Zap Artist"] - Text to display on the button
 * @param {string} [props.buttonClass=""] - Additional CSS classes for the button
 * @param {Function} [props.onSuccess] - Callback for successful zap
 * @param {Function} [props.onError] - Callback for zap error
 */
const WavlakeZap = ({ 
  trackId, 
  amount = 100, 
  buttonText = "Zap Artist",
  buttonClass = "",
  onSuccess,
  onError
}) => {
  const { wallet, isConnected, ensureConnected } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasErrored, setHasErrored] = useState(false);
  // Add payment state to track the current step in the payment process
  const [paymentState, setPaymentState] = useState('idle'); // idle, connecting, fetching, processing, success, error

  const handleZap = async () => {
    if (!trackId) {
      console.error('[WavlakeZap] No track ID provided');
      if (onError) onError(new Error('No track ID provided'));
      return;
    }

    if (!wallet) {
      console.error('[WavlakeZap] No wallet available');
      if (onError) onError(new Error('Lightning wallet not connected. Connect wallet in settings.'));
      return;
    }

    // Set initial processing state
    setIsProcessing(true);
    setHasErrored(false);
    setPaymentState('connecting');
    
    // Note: We're not using optimistic UI updates anymore
    // We'll only notify of success when the payment is actually complete

    try {
      // Run the payment process with proper status updates
      // First ensure wallet is connected
      setPaymentState('connecting');
      if (!isConnected) {
        console.log('[WavlakeZap] Wallet not connected, attempting to connect...');
        const connected = await ensureConnected();
        if (!connected) {
          throw new Error('Failed to connect wallet. Please try again.');
        }
      }
      
      // 1. Get LNURL for track
      setPaymentState('fetching');
      console.log('[WavlakeZap] Getting LNURL for track:', trackId);
      const lnurl = await getLnurlForTrack(trackId);
      
      if (!lnurl) {
        throw new Error('Failed to get LNURL for track');
      }
      
      // 2. Process the payment
      setPaymentState('processing');
      console.log('[WavlakeZap] Processing payment with amount:', amount);
      const result = await processWavlakeLnurlPayment(lnurl, wallet, amount);
      
      console.log('[WavlakeZap] Payment successful:', result);
      
      // Update state to success
      setPaymentState('success');
      
      // Call success callback with result
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess(result);
      }
    } catch (error) {
      console.error('[WavlakeZap] Zap failed:', error);
      
      // Update error state
      setPaymentState('error');
      setHasErrored(true);
      
      // Call error callback if provided
      if (onError && typeof onError === 'function') {
        onError(error);
      }
    } finally {
      // Only stop processing on success or error
      if (paymentState === 'success' || paymentState === 'error') {
        setTimeout(() => {
          setIsProcessing(false);
          // Reset to idle state after showing success/error for a moment
          setTimeout(() => {
            if (paymentState === 'success') {
              setPaymentState('idle');
            }
          }, 2000);
        }, 1000);
      }
    }
  };

  // Different button states
  const buttonContent = () => {
    switch(paymentState) {
      case 'connecting':
        return <span className="zap-processing">Connecting...</span>;
      case 'fetching':
        return <span className="zap-processing">Preparing...</span>;
      case 'processing':
        return <span className="zap-processing">Processing...</span>;
      case 'success':
        return <span className="zap-success-icon">⚡</span>;
      case 'error':
        return <span className="zap-error">⚠️</span>;
      default:
        return (
          <>
            <span className="zap-icon">⚡</span> {buttonText}
          </>
        );
    }
  };

  return (
    <button
      className={`wavlake-zap-button ${buttonClass} ${hasErrored ? 'zap-error-state' : ''} ${isProcessing ? 'zap-processing-state' : ''} ${paymentState === 'success' ? 'zap-success-state' : ''}`}
      onClick={handleZap}
      disabled={isProcessing}
    >
      {buttonContent()}
    </button>
  );
};

WavlakeZap.propTypes = {
  trackId: PropTypes.string.isRequired,
  amount: PropTypes.number,
  buttonText: PropTypes.string,
  buttonClass: PropTypes.string,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
};

export default WavlakeZap; 