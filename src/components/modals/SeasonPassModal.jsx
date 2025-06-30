import React, { useState, useEffect } from 'react';
import { useNostr } from '../../hooks/useNostr';
import { SEASON_1_CONFIG } from '../../config/seasonConfig';
import { isParticipant, getParticipantList, getSeasonStats } from '../../services/seasonPassService';
import SeasonWalletService from '../../services/seasonWalletService';

const SeasonPassModal = ({ isOpen, onClose }) => {
  const { publicKey, ndkReady } = useNostr();
  const [seasonWallet] = useState(() => new SeasonWalletService());
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [seasonStats, setSeasonStats] = useState(null);
  const [userIsParticipant, setUserIsParticipant] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSeasonData();
      connectWallet();
    }
  }, [isOpen, publicKey]);

  const loadSeasonData = async () => {
    try {
      // Check if user is already a participant
      if (publicKey) {
        setUserIsParticipant(isParticipant(publicKey));
      }

      // Load participant list and stats
      const participantList = getParticipantList();
      setParticipants(participantList);

      const stats = getSeasonStats();
      setSeasonStats(stats);
    } catch (error) {
      console.error('[SeasonPassModal] Error loading season data:', error);
    }
  };

  const connectWallet = async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    setConnectionStatus(null);

    try {
      const result = await seasonWallet.connect();
      if (result.success) {
        setConnectionStatus({ success: true, message: 'Connected to season wallet' });
        
        // Get balance
        const balance = await seasonWallet.getBalance();
        setWalletBalance(balance);
      } else {
        setConnectionStatus({ 
          success: false, 
          message: result.error || 'Failed to connect to season wallet' 
        });
      }
    } catch (error) {
      console.error('[SeasonPassModal] Wallet connection error:', error);
      setConnectionStatus({ 
        success: false, 
        message: `Connection failed: ${error.message}` 
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePurchaseSeasonPass = async () => {
    if (!publicKey) {
      setPaymentError('Please connect your Nostr key first');
      return;
    }

    if (userIsParticipant) {
      setPaymentError('You are already a Season 1 participant');
      return;
    }

    setIsProcessingPayment(true);
    setPaymentError(null);
    setCurrentInvoice(null);

    try {
      // Create invoice for season pass
      const invoiceResult = await seasonWallet.createSeasonPassInvoice(publicKey);
      
      if (!invoiceResult.success) {
        throw new Error(invoiceResult.error);
      }

      setCurrentInvoice(invoiceResult.invoice);

      // In a real app, you would show the invoice to the user here
      // For now, we'll simulate payment processing
      console.log('[SeasonPassModal] Invoice created:', invoiceResult.invoice);
      
      // Simulate payment (in real app, user would pay the invoice)
      // For demo purposes, we'll process the payment immediately
      setTimeout(async () => {
        try {
          const paymentResult = await seasonWallet.processSeasonPassPayment(publicKey, {
            amount: SEASON_1_CONFIG.seasonPassPrice,
            invoice: invoiceResult.invoice,
            txid: 'demo_' + Date.now(),
            paidAt: new Date().toISOString()
          });

          if (paymentResult.success) {
            setPaymentSuccess(true);
            setUserIsParticipant(true);
            
            // Reload season data to show updated stats
            await loadSeasonData();
            
            // Show success message
            setTimeout(() => {
              onClose();
              setPaymentSuccess(false);
              setCurrentInvoice(null);
            }, 3000);
          } else {
            throw new Error(paymentResult.error);
          }
        } catch (error) {
          console.error('[SeasonPassModal] Payment processing error:', error);
          setPaymentError(`Payment failed: ${error.message}`);
        } finally {
          setIsProcessingPayment(false);
        }
      }, 2000); // Simulate 2-second payment delay

    } catch (error) {
      console.error('[SeasonPassModal] Purchase error:', error);
      setPaymentError(`Failed to create invoice: ${error.message}`);
      setIsProcessingPayment(false);
    }
  };

  const formatSats = (amount) => {
    return new Intl.NumberFormat().format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysRemaining = () => {
    const endDate = new Date(SEASON_1_CONFIG.endDate);
    const now = new Date();
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-bg-secondary rounded-xl w-full max-w-lg p-6 shadow-xl border border-border-secondary max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-text-primary">{SEASON_1_CONFIG.name}</h2>
          <button 
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors duration-normal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success Message */}
        {paymentSuccess && (
          <div className="mb-6 p-4 bg-success-light border border-success rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-success mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-success font-semibold">Welcome to Season 1!</span>
            </div>
            <p className="text-success mt-1">Payment successful! You are now a participant.</p>
          </div>
        )}

        {/* Season Info */}
        <div className="mb-6 p-4 bg-bg-tertiary rounded-lg border border-border-secondary">
          <h3 className="text-lg font-semibold text-text-primary mb-3">Season Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Duration:</span>
              <span className="text-text-primary">{formatDate(SEASON_1_CONFIG.startDate)} - {formatDate(SEASON_1_CONFIG.endDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Days Remaining:</span>
              <span className="text-text-primary font-semibold">{getDaysRemaining()} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Rules:</span>
              <span className="text-text-primary">{SEASON_1_CONFIG.rules}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Season Pass Price:</span>
              <span className="text-bitcoin font-bold">{formatSats(SEASON_1_CONFIG.seasonPassPrice)} sats</span>
            </div>
          </div>
        </div>

        {/* Current Participants */}
        <div className="mb-6 p-4 bg-bg-tertiary rounded-lg border border-border-secondary">
          <h3 className="text-lg font-semibold text-text-primary mb-3">Participants</h3>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-1">{participants.length}</div>
            <div className="text-sm text-text-secondary">
              {participants.length === 1 ? 'Runner' : 'Runners'} Competing
            </div>
          </div>
          
          {seasonStats && seasonStats.totalDistance > 0 && (
            <div className="mt-4 pt-4 border-t border-border-secondary">
              <div className="text-center">
                <div className="text-xl font-semibold text-text-primary">
                  {seasonStats.totalDistance.toFixed(1)} km
                </div>
                <div className="text-sm text-text-secondary">Total Distance Logged</div>
              </div>
            </div>
          )}
        </div>

        {/* Wallet Connection Status */}
        <div className="mb-6 p-3 bg-bg-tertiary rounded-lg border border-border-secondary">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Wallet Status:</span>
            {isConnecting ? (
              <span className="text-sm text-text-secondary">Connecting...</span>
            ) : connectionStatus ? (
              <span className={`text-sm ${connectionStatus.success ? 'text-success' : 'text-error'}`}>
                {connectionStatus.message}
              </span>
            ) : (
              <span className="text-sm text-text-muted">Not connected</span>
            )}
          </div>
          
          {walletBalance !== null && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-text-secondary">Balance:</span>
              <span className="text-sm text-bitcoin font-semibold">{formatSats(walletBalance)} sats</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {paymentError && (
          <div className="mb-6 p-4 bg-error-light border border-error rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-error mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-error font-semibold">Payment Error</span>
            </div>
            <p className="text-error mt-1">{paymentError}</p>
          </div>
        )}

        {/* Current Invoice Display */}
        {currentInvoice && (
          <div className="mb-6 p-4 bg-warning-light border border-warning rounded-lg">
            <div className="text-center">
              <p className="text-warning font-semibold mb-2">Processing Payment...</p>
              <p className="text-sm text-warning">
                Invoice created. In a real app, you would pay this invoice with your Lightning wallet.
              </p>
              <div className="mt-3">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-warning mx-auto"></div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3">
          {userIsParticipant ? (
            <div className="p-4 bg-success-light border border-success rounded-lg text-center">
              <div className="flex items-center justify-center mb-2">
                <svg className="h-6 w-6 text-success mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-success font-bold">Season Pass Active</span>
              </div>
              <p className="text-success text-sm">You're all set to compete in Season 1!</p>
            </div>
          ) : (
            <>
              <button
                onClick={handlePurchaseSeasonPass}
                disabled={!ndkReady || !publicKey || isProcessingPayment || isConnecting}
                className="w-full px-6 py-3 bg-primary hover:bg-primary-hover disabled:bg-text-muted text-text-primary font-bold rounded-lg transition-colors duration-normal flex items-center justify-center"
              >
                {isProcessingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-text-primary mr-2"></div>
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Purchase Season Pass ({formatSats(SEASON_1_CONFIG.seasonPassPrice)} sats)
                  </>
                )}
              </button>
              
              {!ndkReady || !publicKey ? (
                <p className="text-xs text-warning text-center">
                  Please connect your Nostr key to purchase a season pass
                </p>
              ) : null}
            </>
          )}
          
          <button
            onClick={onClose}
            className="w-full px-6 py-2 border border-border-secondary text-text-secondary hover:bg-bg-tertiary rounded-lg transition-colors duration-normal"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SeasonPassModal; 