import React, { useState } from 'react';
import { useSeasonSubscription } from '../hooks/useSeasonSubscription';
import { useSubscriptionWalletBalance } from '../hooks/useSubscriptionWalletBalance';
import { useAuth } from '../hooks/useAuth';

/**
 * Demo component showcasing the new NWC-based Season 1 subscription system
 */
export const Season1SubscriptionCard = () => {
  const { user } = useAuth();
  const userPubkey = user?.pubkey;

  // Use the new subscription hook with automatic payment polling
  const { 
    phase, 
    tier, 
    subscribe, 
    isProcessing, 
    currentInvoice,
    paymentStatus,
    statusMessage
  } = useSeasonSubscription(userPubkey);

  // Use the wallet balance hook to show collected funds
  const { 
    balance, 
    alias, 
    success: balanceSuccess, 
    error: balanceError, 
    isLoading: balanceLoading, 
    refresh 
  } = useSubscriptionWalletBalance();

  const [selectedTier, setSelectedTier] = useState('member');

  const handleSubscribe = async (tier) => {
    try {
      setSelectedTier(tier);
      console.log(`Generating ${tier} subscription invoice...`);
      
      const invoice = await subscribe(tier);
      
      console.log('Invoice generated:', invoice.invoice);
      // Note: Payment polling is now automatic, no manual step needed
    } catch (error) {
      console.error('Subscription failed:', error);
    }
  };

  // Get appropriate status color for payment status
  const getStatusColor = () => {
    switch (paymentStatus) {
      case 'pending': return 'text-yellow-400';
      case 'polling': return 'text-blue-400';
      case 'paid': return 'text-green-400';
      case 'expired': return 'text-red-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  // Get appropriate status icon
  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'pending': return '⏳';
      case 'polling': return '🔄';
      case 'paid': return '✅';
      case 'expired': return '⌛';
      case 'error': return '❌';
      default: return '';
    }
  };

  if (!userPubkey) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-white">
        <h3 className="text-lg font-bold mb-2">Season 1 Subscription</h3>
        <p>Please connect your Nostr account to view subscription options.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 text-white max-w-md mx-auto">
      <h3 className="text-xl font-bold mb-4">RUNSTR Season 1</h3>
      
      {/* Wallet Balance Display */}
      <div className="bg-gray-700 rounded-lg p-4 mb-4">
        <h4 className="font-semibold mb-2">Collection Wallet Balance</h4>
        {balanceLoading ? (
          <p className="text-gray-300">Loading balance...</p>
        ) : balanceError ? (
          <p className="text-red-400">Error: {balanceError}</p>
        ) : (
          <div>
            <p className="text-2xl font-bold text-green-400">{balance.toLocaleString()} sats</p>
            <p className="text-sm text-gray-300">{alias}</p>
            <button 
              onClick={refresh}
              className="mt-2 text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded"
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Subscription Status */}
      <div className="mb-4">
        <h4 className="font-semibold mb-2">Your Status</h4>
        {phase === 'current' ? (
          <p className="text-green-400">✅ Active {tier} subscriber</p>
        ) : (
          <p className="text-yellow-400">⏳ Not subscribed</p>
        )}
      </div>

      {/* Payment Status Display */}
      {(paymentStatus !== 'none' || statusMessage) && (
        <div className="mb-4 bg-gray-700 rounded-lg p-3">
          <h4 className="font-semibold mb-2">Payment Status</h4>
          <div className={`flex items-center gap-2 ${getStatusColor()}`}>
            <span>{getStatusIcon()}</span>
            <p className="text-sm">
              {statusMessage || `Status: ${paymentStatus}`}
            </p>
          </div>
          
          {/* Show invoice for copying if needed */}
          {currentInvoice && paymentStatus === 'polling' && (
            <div className="mt-3">
              <p className="text-xs text-gray-300 mb-2">
                Pay this invoice with your Lightning wallet:
              </p>
              <div className="bg-gray-600 p-2 rounded text-xs break-all">
                {currentInvoice.invoice.substring(0, 100)}...
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Amount: {currentInvoice.amount.toLocaleString()} sats
              </p>
            </div>
          )}
        </div>
      )}

      {/* Subscription Options */}
      {phase !== 'current' && paymentStatus === 'none' && (
        <div className="space-y-3">
          <h4 className="font-semibold">Subscribe to Season 1</h4>
          
          {/* Member Option */}
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Member</p>
                <p className="text-sm text-gray-300">5,000 sats</p>
                <p className="text-xs text-gray-400">Access to Season 1 features</p>
              </div>
              <button
                onClick={() => handleSubscribe('member')}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded text-sm"
              >
                {isProcessing ? 'Processing...' : 'Subscribe'}
              </button>
            </div>
          </div>

          {/* Captain Option */}
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Captain</p>
                <p className="text-sm text-gray-300">10,000 sats</p>
                <p className="text-xs text-gray-400">Premium features + team management</p>
              </div>
              <button
                onClick={() => handleSubscribe('captain')}
                disabled={isProcessing}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded text-sm"
              >
                {isProcessing ? 'Processing...' : 'Subscribe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions for active subscription process */}
      {currentInvoice && paymentStatus === 'polling' && (
        <div className="mt-4 bg-blue-900 border border-blue-600 rounded-lg p-3">
          <h4 className="font-semibold text-blue-100 mb-2">Payment Instructions</h4>
          <div className="text-sm text-blue-200 space-y-1">
            <p>• Copy the invoice above</p>
            <p>• Open your Lightning wallet</p>
            <p>• Paste and pay the invoice</p>
            <p>• We'll automatically detect payment and complete your subscription</p>
          </div>
          <p className="text-xs text-blue-300 mt-2">
            No need to return to this screen - your subscription will activate automatically!
          </p>
        </div>
      )}

      {/* Error Recovery Options */}
      {paymentStatus === 'error' && (
        <div className="mt-4">
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Expired Invoice Recovery */}
      {paymentStatus === 'expired' && (
        <div className="mt-4">
          <button
            onClick={() => handleSubscribe(selectedTier)}
            disabled={isProcessing}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 px-4 py-2 rounded text-sm"
          >
            Generate New Invoice
          </button>
        </div>
      )}
    </div>
  );
}; 